import { afterEach, describe, expect, it, vi } from "vitest";
import { DailyLogService } from "./daily-log.service.js";
import type { DailyLogRepository, TodoItemRecord } from "./daily-log.repository.js";

function createTodo(overrides: Partial<TodoItemRecord> = {}): TodoItemRecord {
  return {
    id: "todo-1",
    content: "할 일",
    done: false,
    order: 0,
    createdAt: new Date("2026-04-29T00:00:00.000Z"),
    startedAt: null,
    scheduledStartAt: null,
    pausedAt: null,
    completedAt: null,
    deviationSeconds: 0,
    actualFocusSeconds: null,
    ...overrides,
  };
}

function createLog(todos: TodoItemRecord[], overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    dateKey: "2026-04-29",
    monthKey: "2026-04",
    memo: null,
    todos,
    todoCount: todos.length,
    doneCount: todos.filter((todo) => todo.done).length,
    previewTodos: todos.map((todo) => todo.content).slice(0, 3),
    restStartedAt: null,
    restAccumulatedSeconds: 0,
    ...overrides,
  };
}

function createService() {
  const repository = {
    findByDate: vi.fn(),
    replaceTodos: vi.fn(),
    upsertDailyLog: vi.fn(),
    findTasksByIds: vi.fn(),
    updateTaskLastUsedAt: vi.fn(),
    startRestSession: vi.fn(),
    stopRestSession: vi.fn(),
  };
  const service = new DailyLogService(repository as unknown as DailyLogRepository);
  return { service, repository };
}

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("DailyLogService", () => {
  it("startTodo 호출 시 대상 todo를 진행 중 상태로 변경한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:00:00.000Z"));

    const { service, repository } = createService();
    const log = createLog([createTodo()]);
    repository.findByDate.mockResolvedValue(log);
    repository.replaceTodos.mockImplementation(async (_userId, _dateKey, todos) => createLog(todos));

    await service.startTodo({ userId: "user-1", dateKey: "2026-04-29", todoId: "todo-1" });

    expect(repository.replaceTodos).toHaveBeenCalledTimes(1);
    const [, , nextTodos] = repository.replaceTodos.mock.calls[0] as [string, string, TodoItemRecord[]];
    expect(nextTodos[0]).toMatchObject({
      id: "todo-1",
      done: false,
      pausedAt: null,
      completedAt: null,
      scheduledStartAt: null,
    });
    expect(nextTodos[0].startedAt?.toISOString()).toBe("2026-04-29T10:00:00.000Z");
  });

  it("다른 todo가 이미 진행 중이면 startTodo에서 에러를 반환한다", async () => {
    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([
        createTodo({ id: "todo-1" }),
        createTodo({
          id: "todo-2",
          startedAt: new Date("2026-04-29T09:00:00.000Z"),
          pausedAt: null,
          done: false,
        }),
      ])
    );

    await expect(
      service.startTodo({ userId: "user-1", dateKey: "2026-04-29", todoId: "todo-1" })
    ).rejects.toThrow("ANOTHER_TODO_ALREADY_IN_PROGRESS");
    expect(repository.replaceTodos).not.toHaveBeenCalled();
  });

  it("이미 일시정지된 todo는 pauseTodo 호출 시 원본 로그를 반환한다", async () => {
    const { service, repository } = createService();
    const log = createLog([
      createTodo({
        id: "todo-1",
        startedAt: new Date("2026-04-29T09:00:00.000Z"),
        pausedAt: new Date("2026-04-29T09:10:00.000Z"),
      }),
    ]);
    repository.findByDate.mockResolvedValue(log);

    const result = await service.pauseTodo({ userId: "user-1", dateKey: "2026-04-29", todoId: "todo-1" });

    expect(result).toBe(log);
    expect(repository.replaceTodos).not.toHaveBeenCalled();
  });

  it("오늘 날짜의 과거 시각 예약은 updateTodoSchedule에서 거부한다", async () => {
    vi.useFakeTimers();
    const now = new Date("2026-04-29T10:00:00.000Z");
    vi.setSystemTime(now);

    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(createLog([createTodo({ id: "todo-1" })]));

    const todayDateKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;

    await expect(
      service.updateTodoSchedule({
        userId: "user-1",
        dateKey: todayDateKey,
        todoId: "todo-1",
        scheduledStartAt: "2026-04-29T09:59:59.000Z",
      })
    ).rejects.toThrow("SCHEDULE_MUST_BE_FUTURE_FOR_TODAY");
    expect(repository.replaceTodos).not.toHaveBeenCalled();
  });

  it("completeTodo 호출 시 실제 집중 시간과 완료 시각을 반영한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:10:00.000Z"));

    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([
        createTodo({
          id: "todo-1",
          startedAt: new Date("2026-04-29T10:00:00.000Z"),
          pausedAt: new Date("2026-04-29T10:09:30.000Z"),
          deviationSeconds: 60,
        }),
      ])
    );
    repository.replaceTodos.mockImplementation(async (_userId, _dateKey, todos) => createLog(todos));

    await service.completeTodo({ userId: "user-1", dateKey: "2026-04-29", todoId: "todo-1" });

    const [, , nextTodos] = repository.replaceTodos.mock.calls[0] as [string, string, TodoItemRecord[]];
    expect(nextTodos[0]).toMatchObject({
      id: "todo-1",
      done: true,
      pausedAt: null,
      deviationSeconds: 90,
      actualFocusSeconds: 510,
    });
    expect(nextTodos[0].completedAt?.toISOString()).toBe("2026-04-29T10:10:00.000Z");
  });

  it("resumeTodo 호출 시 paused 구간을 deviationSeconds에 누적한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:10:00.000Z"));

    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([
        createTodo({
          id: "todo-1",
          startedAt: new Date("2026-04-29T10:00:00.000Z"),
          pausedAt: new Date("2026-04-29T10:09:30.000Z"),
          deviationSeconds: 60,
        }),
      ])
    );
    repository.replaceTodos.mockImplementation(async (_userId, _dateKey, todos) => createLog(todos));

    await service.resumeTodo({ userId: "user-1", dateKey: "2026-04-29", todoId: "todo-1" });

    const [, , nextTodos] = repository.replaceTodos.mock.calls[0] as [string, string, TodoItemRecord[]];
    expect(nextTodos[0]).toMatchObject({
      id: "todo-1",
      pausedAt: null,
      scheduledStartAt: null,
      deviationSeconds: 90,
    });
  });

  it("reorderTodos 호출 시 유효하지 않은 todoIds를 거부한다", async () => {
    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([createTodo({ id: "todo-1", order: 0 }), createTodo({ id: "todo-2", order: 1 })])
    );

    await expect(
      service.reorderTodos({
        userId: "user-1",
        dateKey: "2026-04-29",
        todoIds: ["todo-1", "todo-1"],
      })
    ).rejects.toThrow("INVALID_TODO_ORDER_IDS");
    expect(repository.replaceTodos).not.toHaveBeenCalled();
  });

  it("updateTodoActualFocusSeconds 호출 시 완료되지 않은 todo를 거부한다", async () => {
    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([
        createTodo({
          id: "todo-1",
          done: false,
          startedAt: new Date("2026-04-29T10:00:00.000Z"),
        }),
      ])
    );

    await expect(
      service.updateTodoActualFocusSeconds({
        userId: "user-1",
        dateKey: "2026-04-29",
        todoId: "todo-1",
        actualFocusSeconds: 120,
      })
    ).rejects.toThrow("TODO_NOT_DONE");
    expect(repository.replaceTodos).not.toHaveBeenCalled();
  });

  it("updateTodoActualFocusSeconds 호출 시 음수 입력을 0으로 보정한다", async () => {
    const { service, repository } = createService();
    repository.findByDate.mockResolvedValue(
      createLog([
        createTodo({
          id: "todo-1",
          done: true,
          startedAt: new Date("2026-04-29T10:00:00.000Z"),
          completedAt: new Date("2026-04-29T10:05:00.000Z"),
          deviationSeconds: 20,
          actualFocusSeconds: 300,
        }),
      ])
    );
    repository.replaceTodos.mockImplementation(async (_userId, _dateKey, todos) => createLog(todos));

    await service.updateTodoActualFocusSeconds({
      userId: "user-1",
      dateKey: "2026-04-29",
      todoId: "todo-1",
      actualFocusSeconds: -15,
    });

    const [, , nextTodos] = repository.replaceTodos.mock.calls[0] as [string, string, TodoItemRecord[]];
    expect(nextTodos[0].actualFocusSeconds).toBe(0);
    expect(nextTodos[0].completedAt?.toISOString()).toBe("2026-04-29T10:00:20.000Z");
  });

  it("addTodos 호출 시 taskId 및 content 중복 항목을 제외한다", async () => {
    const { service, repository } = createService();
    repository.upsertDailyLog.mockResolvedValue(
      createLog([
        createTodo({ id: "todo-existing-task", taskId: "task-1", content: "기존 task" }),
        createTodo({ id: "todo-existing-content", taskId: null, content: "중복 콘텐츠", order: 1 }),
      ])
    );
    repository.findTasksByIds.mockResolvedValue([
      { id: "task-1", title: "기존 task" },
      { id: "task-2", title: "새 task" },
    ]);
    repository.replaceTodos.mockImplementation(async (_userId, _dateKey, todos) => createLog(todos));
    repository.updateTaskLastUsedAt.mockResolvedValue(undefined);

    await service.addTodos({
      userId: "user-1",
      dateKey: "2026-04-29",
      items: [
        { content: "추가-1", taskId: "task-1" },
        { content: "중복 콘텐츠", taskId: null },
        { content: "추가-2", taskId: "task-2" },
        { content: "새 텍스트", taskId: null },
        { content: "   ", taskId: null },
      ],
    });

    const [, , nextTodos] = repository.replaceTodos.mock.calls[0] as [string, string, TodoItemRecord[]];
    expect(nextTodos).toHaveLength(4);
    expect(nextTodos.map((todo) => todo.content)).toEqual(["기존 task", "중복 콘텐츠", "추가-2", "새 텍스트"]);
    expect(repository.updateTaskLastUsedAt).toHaveBeenCalledTimes(1);
    expect(repository.updateTaskLastUsedAt).toHaveBeenCalledWith(
      "user-1",
      "task-2",
      expect.any(Date)
    );
  });

  it("startRestSession 호출 시 이미 휴식 중이면 변경 없이 반환한다", async () => {
    const { service, repository } = createService();
    const restLog = createLog([], { restStartedAt: new Date("2026-04-29T10:00:00.000Z") });
    repository.upsertDailyLog.mockResolvedValue(restLog);

    const result = await service.startRestSession({
      userId: "user-1",
      dateKey: "2026-04-29",
    });

    expect(result).toBe(restLog);
    expect(repository.startRestSession).not.toHaveBeenCalled();
  });

  it("stopRestSession 호출 시 경과 시간을 누적 반영한다", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-29T10:03:30.000Z"));

    const { service, repository } = createService();
    repository.upsertDailyLog.mockResolvedValue(
      createLog([], {
        restStartedAt: new Date("2026-04-29T10:00:00.000Z"),
        restAccumulatedSeconds: 120,
      })
    );
    repository.stopRestSession.mockResolvedValue(createLog([], { restStartedAt: null, restAccumulatedSeconds: 330 }));

    await service.stopRestSession({
      userId: "user-1",
      dateKey: "2026-04-29",
    });

    expect(repository.stopRestSession).toHaveBeenCalledWith("user-1", "2026-04-29", 330);
  });
});
