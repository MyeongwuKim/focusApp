import { describe, expect, it, vi } from "vitest";
import { runNotificationBatch } from "./notification-batch.service.js";

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    pushEnabled: true,
    systemPermission: "granted",
    typeFocusStart: true,
    typeIncomplete: true,
    dayMode: "everyday",
    activeStartTime: "00:00",
    activeEndTime: "23:59",
    intervalMinutes: 30,
    tone: "balanced",
    lastFocusReminderSentAt: null,
    lastEmptyTodoReminderDate: null,
    ...overrides,
  };
}

function createTodo(overrides: Record<string, unknown> = {}) {
  return {
    id: "todo-1",
    done: false,
    content: "첫번째 할일",
    titleSnapshot: null,
    order: 0,
    startedAt: null,
    pausedAt: null,
    completedAt: null,
    scheduledStartAt: null,
    ...overrides,
  };
}

function createPrismaMock(input: {
  settings?: Array<Record<string, unknown>>;
  todos?: Array<Record<string, unknown>>;
  userCreatedAt?: Date;
}) {
  const settings = input.settings ?? [createSettings()];
  const todos = input.todos ?? [];
  const userCreatedAt = input.userCreatedAt ?? new Date("2025-01-01T00:00:00.000Z");
  const activeSessions = Array.from(
    new Set(settings.map((setting) => String(setting.userId ?? "user-1")))
  ).map((userId) => ({ userId }));

  return {
    session: {
      findMany: vi.fn(async () => activeSessions),
    },
    notificationSettings: {
      findMany: vi.fn(async () => settings),
      update: vi.fn(async () => ({})),
    },
    dailyLog: {
      findUnique: vi.fn(async () => ({
        todoCount: todos.length,
        todos,
      })),
    },
    pushDeviceToken: {
      findMany: vi.fn(async () => []),
      updateMany: vi.fn(async () => ({ count: 0 })),
    },
    user: {
      findMany: vi.fn(async () =>
        activeSessions.map((session) => ({
          id: session.userId,
          createdAt: userCreatedAt,
        }))
      ),
    },
  };
}

describe("runNotificationBatch", () => {
  it("첫번째 미완료가 미시작 상태면 미완료 리마인드를 보낸다", async () => {
    const prisma = createPrismaMock({
      todos: [createTodo({ content: "A", order: 0 }), createTodo({ id: "todo-2", content: "B", order: 1 })],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T08:00:00.000Z"),
      dryRun: true,
      force: true,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(1);
    expect(result.deliveries[0]).toMatchObject({
      userId: "user-1",
      kind: "incomplete_todo",
      title: "작업 리마인드",
    });
    expect(result.deliveries[0]?.body).toContain("A");
  });

  it("첫번째 미완료가 중지 상태면 미완료 리마인드를 보낸다", async () => {
    const prisma = createPrismaMock({
      todos: [
        createTodo({
          content: "A",
          order: 0,
          startedAt: new Date("2026-05-04T07:00:00.000Z"),
          pausedAt: new Date("2026-05-04T07:30:00.000Z"),
        }),
      ],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T08:00:00.000Z"),
      dryRun: true,
      force: true,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(1);
    expect(result.deliveries[0]?.kind).toBe("incomplete_todo");
    expect(result.deliveries[0]?.body).toContain("A");
  });

  it("첫번째 미완료가 진행 중이면 다음 미시작 할일이 있어도 알림을 보내지 않는다", async () => {
    const prisma = createPrismaMock({
      todos: [
        createTodo({
          content: "A",
          order: 0,
          startedAt: new Date("2026-05-04T07:00:00.000Z"),
          pausedAt: null,
        }),
        createTodo({
          id: "todo-2",
          content: "B",
          order: 1,
          startedAt: null,
          pausedAt: null,
        }),
      ],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T08:00:00.000Z"),
      dryRun: true,
      force: true,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(0);
    expect(result.deliveries).toHaveLength(0);
  });

  it("첫번째 할일이 완료되면 다음 미완료 할일 기준으로 리마인드를 보낸다", async () => {
    const prisma = createPrismaMock({
      todos: [
        createTodo({
          content: "A",
          order: 0,
          done: true,
          completedAt: new Date("2026-05-04T07:00:00.000Z"),
        }),
        createTodo({
          id: "todo-2",
          content: "B",
          order: 1,
          done: false,
          startedAt: null,
        }),
      ],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T08:00:00.000Z"),
      dryRun: true,
      force: true,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(1);
    expect(result.deliveries[0]?.kind).toBe("incomplete_todo");
    expect(result.deliveries[0]?.body).toContain("B");
  });

  it("가입 후 24시간 이내 유저에게는 알림을 보내지 않는다", async () => {
    const prisma = createPrismaMock({
      userCreatedAt: new Date("2026-05-04T07:00:00.000Z"),
      todos: [createTodo({ content: "A", order: 0 })],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T20:00:00.000Z"),
      dryRun: true,
      force: false,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(0);
    expect(result.deliveries).toHaveLength(0);
  });
});
