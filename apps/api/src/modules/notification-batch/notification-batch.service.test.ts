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
    targetFocusMinutes: null,
    deviationSeconds: 0,
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
      updateMany: vi.fn(async () => ({ count: 1 })),
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
      title: "할일 이어가기",
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

  it("첫번째 미완료가 오늘은 그만 상태면 다음 미완료 할일로 리마인드를 보낸다", async () => {
    const prisma = createPrismaMock({
      todos: [
        createTodo({
          content: "A",
          order: 0,
          muteReminderDateKey: "2026-05-04",
        }),
        createTodo({
          id: "todo-2",
          content: "B",
          order: 1,
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

  it("nextReminderAt 도달 시에는 마지막 발송 시각과 무관하게 일반 리마인드를 보낸다", async () => {
    const prisma = createPrismaMock({
      settings: [
        createSettings({
          intervalMinutes: 30,
          nextReminderAt: new Date("2026-05-04T08:00:00.000Z"),
        }),
      ],
      todos: [createTodo({ content: "A", order: 0 })],
    });

    const result = await runNotificationBatch({
      prisma: prisma as never,
      now: new Date("2026-05-04T08:00:00.000Z"),
      dryRun: false,
      force: false,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(1);
    expect(result.deliveries).toHaveLength(1);
  });

  it("다음 알림 시각이 과하게 미래로 밀리면 배치 실행 중 다음 간격 슬롯으로 자동 보정한다", async () => {
    const prisma = createPrismaMock({
      settings: [
        createSettings({
          intervalMinutes: 30,
          nextReminderAt: new Date("2026-05-12T12:00:00.000Z"),
        }),
      ],
      todos: [createTodo({ content: "A", order: 0 })],
    });

    const now = new Date("2026-05-04T08:00:00.000Z");
    const result = await runNotificationBatch({
      prisma: prisma as never,
      now,
      dryRun: false,
      force: false,
      timezone: "Asia/Seoul",
    });

    expect(result.sentCount).toBe(0);
    expect(prisma.notificationSettings.update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { nextReminderAt: new Date("2026-05-04T08:30:00.000Z") },
    });
  });
});
