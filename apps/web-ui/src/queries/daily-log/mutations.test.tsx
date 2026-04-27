import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as dailyLogApi from "../../api/dailyLogApi";
import { taskCollectionsQueryKey } from "../task-collection/queries";
import {
  useAddTodoDeviationToDailyLogMutation,
  useAddTodosToDailyLogMutation,
  useCompleteTodoFromDailyLogMutation,
  usePauseTodoFromDailyLogMutation,
  useResetTodoFromDailyLogMutation,
  useResumeTodoFromDailyLogMutation,
  useStartTodoFromDailyLogMutation,
} from "./mutations";
import { dailyLogByDateQueryKey, dailyLogsByMonthQueryKey, statsDailyDetailQueryKey } from "./queries";

type DailyLogApiModule = typeof import("../../api/dailyLogApi");

vi.mock("../../api/dailyLogApi", async () => {
  const actual = await vi.importActual<DailyLogApiModule>("../../api/dailyLogApi");
  const overrides = {
    addTodosToDailyLog: vi.fn(),
    deleteTodoFromDailyLog: vi.fn(),
    startTodoFromDailyLog: vi.fn(),
    pauseTodoFromDailyLog: vi.fn(),
    resumeTodoFromDailyLog: vi.fn(),
    completeTodoFromDailyLog: vi.fn(),
    resetTodoFromDailyLog: vi.fn(),
    addTodoDeviationToDailyLog: vi.fn(),
    reorderTodosFromDailyLog: vi.fn(),
    updateTodoActualFocusFromDailyLog: vi.fn(),
    updateTodoScheduleFromDailyLog: vi.fn(),
    startRestSession: vi.fn(),
    stopRestSession: vi.fn(),
    upsertDailyLogMemo: vi.fn(),
  } satisfies Partial<DailyLogApiModule>;

  return {
    ...actual,
    ...overrides,
  };
});

type DailyLogDetail = Awaited<ReturnType<typeof dailyLogApi.addTodosToDailyLog>>;
type MonthlyLogSnapshot = Awaited<ReturnType<typeof dailyLogApi.fetchDailyLogsByMonth>>[number];

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, resolve, reject };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function buildDailyLogDetail(input?: {
  dateKey?: string;
  todo?: Partial<DailyLogDetail["todos"][number]>;
  restAccumulatedSeconds?: number;
  restStartedAt?: string | null;
}): DailyLogDetail {
  const dateKey = input?.dateKey ?? "2026-04-25";
  return {
    dateKey,
    memo: null,
    restAccumulatedSeconds: input?.restAccumulatedSeconds ?? 0,
    restStartedAt: input?.restStartedAt ?? null,
    todos: [
      {
        id: "todo-1",
        taskId: "task-1",
        titleSnapshot: "할일 1",
        content: "할일 1",
        done: false,
        order: 0,
        startedAt: "2026-04-25T08:00:00.000Z",
        scheduledStartAt: null,
        pausedAt: null,
        completedAt: null,
        deviationSeconds: 0,
        actualFocusSeconds: null,
        ...input?.todo,
      },
    ],
  };
}

function toMonthlySnapshot(payload: DailyLogDetail): MonthlyLogSnapshot {
  const orderedTodos = [...payload.todos].sort((a, b) => a.order - b.order);
  return {
    id: `daily-log-${payload.dateKey}`,
    userId: "user-1",
    dateKey: payload.dateKey,
    monthKey: payload.dateKey.slice(0, 7),
    memo: payload.memo,
    todoCount: orderedTodos.length,
    doneCount: orderedTodos.filter((todo) => todo.done).length,
    previewTodos: orderedTodos.map((todo) => todo.content).slice(0, 3),
    todos: orderedTodos.map((todo) => ({
      id: todo.id,
      taskId: todo.taskId,
      titleSnapshot: todo.titleSnapshot,
      content: todo.content,
      done: todo.done,
      order: todo.order,
    })),
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("daily-log mutations optimistic cache flow", () => {
  it("완료 처리 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({ dateKey });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        done: true,
        completedAt: "2026-04-25T09:00:00.000Z",
        actualFocusSeconds: 3600,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.completeTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useCompleteTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.done).toBe(true);
    });
    await waitFor(() => {
      const optimisticMonth = queryClient.getQueryData<MonthlyLogSnapshot[]>(
        dailyLogsByMonthQueryKey(monthKey)
      );
      expect(optimisticMonth?.[0]?.doneCount).toBe(1);
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("완료 처리 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({ dateKey });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.completeTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useCompleteTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.done).toBe(true);
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(rolledBackLog?.todos[0]?.done).toBe(false);
    });
    await waitFor(() => {
      const rolledBackMonth = queryClient.getQueryData<MonthlyLogSnapshot[]>(
        dailyLogsByMonthQueryKey(monthKey)
      );
      expect(rolledBackMonth?.[0]?.doneCount).toBe(0);
    });
  });

  it("taskId 포함 항목 추가 성공 시 taskCollections 재동기화를 요청한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({ dateKey });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        id: "todo-2",
        taskId: "task-2",
        titleSnapshot: "새 할일",
        content: "새 할일",
      },
    });

    vi.mocked(dailyLogApi.addTodosToDailyLog).mockResolvedValueOnce(successLog);

    const queryClient = createQueryClient();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => useAddTodosToDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    await result.current.mutateAsync({
      dateKey,
      items: [{ content: "새 할일", taskId: "task-2" }],
    });

    const hasTaskCollectionsInvalidation = invalidateSpy.mock.calls.some(([arg]) => {
      if (!arg || typeof arg !== "object") {
        return false;
      }
      const target = arg as { queryKey?: readonly unknown[]; refetchType?: string; exact?: boolean };
      return (
        JSON.stringify(target.queryKey) === JSON.stringify(taskCollectionsQueryKey) &&
        target.refetchType === "all" &&
        target.exact === true
      );
    });

    expect(hasTaskCollectionsInvalidation).toBe(true);
  });

  it("시작 처리 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: null,
        scheduledStartAt: "2026-04-25T10:00:00.000Z",
      },
    });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:30:00.000Z",
        scheduledStartAt: null,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.startTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useStartTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.startedAt).not.toBeNull();
      expect(optimisticLog?.todos[0]?.scheduledStartAt).toBeNull();
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("시작 처리 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: null,
        scheduledStartAt: "2026-04-25T10:00:00.000Z",
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.startTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useStartTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.startedAt).not.toBeNull();
      expect(optimisticLog?.todos[0]?.scheduledStartAt).toBeNull();
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(rolledBackLog?.todos[0]?.startedAt).toBeNull();
      expect(rolledBackLog?.todos[0]?.scheduledStartAt).toBe("2026-04-25T10:00:00.000Z");
    });
  });

  it("일시정지 처리 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: null,
      },
    });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: "2026-04-25T09:30:00.000Z",
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.pauseTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => usePauseTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const optimisticStats = queryClient.getQueryData<DailyLogDetail>(statsDailyDetailQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.pausedAt).not.toBeNull();
      expect(optimisticStats?.todos[0]?.pausedAt).not.toBeNull();
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("일시정지 처리 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: null,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.pauseTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => usePauseTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.pausedAt).not.toBeNull();
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const rolledBackStats = queryClient.getQueryData<DailyLogDetail>(statsDailyDetailQueryKey(dateKey));
      expect(rolledBackLog?.todos[0]?.pausedAt).toBeNull();
      expect(rolledBackStats?.todos[0]?.pausedAt).toBeNull();
    });
  });

  it("재개 처리 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: "2026-04-25T09:10:00.000Z",
        deviationSeconds: 10,
      },
    });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: null,
        deviationSeconds: 120,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.resumeTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => useResumeTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.pausedAt).toBeNull();
      expect(optimisticLog?.todos[0]?.deviationSeconds).toBeGreaterThan(10);
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("재개 처리 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        startedAt: "2026-04-25T09:00:00.000Z",
        pausedAt: "2026-04-25T09:10:00.000Z",
        deviationSeconds: 10,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.resumeTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => useResumeTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.pausedAt).toBeNull();
      expect(optimisticLog?.todos[0]?.deviationSeconds).toBeGreaterThan(10);
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const rolledBackStats = queryClient.getQueryData<DailyLogDetail>(statsDailyDetailQueryKey(dateKey));
      expect(rolledBackLog?.todos[0]?.pausedAt).toBe("2026-04-25T09:10:00.000Z");
      expect(rolledBackLog?.todos[0]?.deviationSeconds).toBe(10);
      expect(rolledBackStats?.todos[0]?.pausedAt).toBe("2026-04-25T09:10:00.000Z");
      expect(rolledBackStats?.todos[0]?.deviationSeconds).toBe(10);
    });
  });

  it("초기화 처리 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        done: true,
        startedAt: "2026-04-25T08:00:00.000Z",
        pausedAt: "2026-04-25T08:30:00.000Z",
        completedAt: "2026-04-25T09:00:00.000Z",
        deviationSeconds: 300,
        actualFocusSeconds: 1800,
      },
    });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        done: false,
        startedAt: null,
        pausedAt: null,
        completedAt: null,
        deviationSeconds: 0,
        actualFocusSeconds: null,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.resetTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useResetTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const optimisticMonth = queryClient.getQueryData<MonthlyLogSnapshot[]>(
        dailyLogsByMonthQueryKey(monthKey)
      );
      expect(optimisticLog?.todos[0]?.done).toBe(false);
      expect(optimisticLog?.todos[0]?.startedAt).toBeNull();
      expect(optimisticLog?.todos[0]?.pausedAt).toBeNull();
      expect(optimisticLog?.todos[0]?.completedAt).toBeNull();
      expect(optimisticLog?.todos[0]?.deviationSeconds).toBe(0);
      expect(optimisticLog?.todos[0]?.actualFocusSeconds).toBeNull();
      expect(optimisticMonth?.[0]?.doneCount).toBe(0);
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("초기화 처리 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const monthKey = "2026-04";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        done: true,
        startedAt: "2026-04-25T08:00:00.000Z",
        pausedAt: "2026-04-25T08:30:00.000Z",
        completedAt: "2026-04-25T09:00:00.000Z",
        deviationSeconds: 300,
        actualFocusSeconds: 1800,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.resetTodoFromDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);
    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [toMonthlySnapshot(initialLog)]);

    const { result } = renderHook(() => useResetTodoFromDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({ dateKey, todoId: "todo-1" });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.done).toBe(false);
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const rolledBackMonth = queryClient.getQueryData<MonthlyLogSnapshot[]>(
        dailyLogsByMonthQueryKey(monthKey)
      );
      expect(rolledBackLog?.todos[0]?.done).toBe(true);
      expect(rolledBackLog?.todos[0]?.startedAt).toBe("2026-04-25T08:00:00.000Z");
      expect(rolledBackLog?.todos[0]?.pausedAt).toBe("2026-04-25T08:30:00.000Z");
      expect(rolledBackLog?.todos[0]?.completedAt).toBe("2026-04-25T09:00:00.000Z");
      expect(rolledBackLog?.todos[0]?.deviationSeconds).toBe(300);
      expect(rolledBackLog?.todos[0]?.actualFocusSeconds).toBe(1800);
      expect(rolledBackMonth?.[0]?.doneCount).toBe(1);
    });
  });

  it("이탈시간 추가 시 서버 응답 전에도 낙관적 캐시를 반영한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        deviationSeconds: 10,
      },
    });
    const successLog = buildDailyLogDetail({
      dateKey,
      todo: {
        deviationSeconds: 130,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.addTodoDeviationToDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => useAddTodoDeviationToDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({
      dateKey,
      todoId: "todo-1",
      seconds: 120,
    });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const optimisticStats = queryClient.getQueryData<DailyLogDetail>(statsDailyDetailQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.deviationSeconds).toBe(130);
      expect(optimisticStats?.todos[0]?.deviationSeconds).toBe(130);
    });

    deferred.resolve(successLog);
    await expect(mutationPromise).resolves.toEqual(successLog);
  });

  it("이탈시간 추가 실패 시 낙관적 캐시를 이전 상태로 원복한다", async () => {
    const dateKey = "2026-04-25";
    const initialLog = buildDailyLogDetail({
      dateKey,
      todo: {
        deviationSeconds: 10,
      },
    });
    const deferred = createDeferred<DailyLogDetail>();

    vi.mocked(dailyLogApi.addTodoDeviationToDailyLog).mockReturnValueOnce(deferred.promise);

    const queryClient = createQueryClient();
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), initialLog);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), initialLog);

    const { result } = renderHook(() => useAddTodoDeviationToDailyLogMutation(), {
      wrapper: createWrapper(queryClient),
    });

    const mutationPromise = result.current.mutateAsync({
      dateKey,
      todoId: "todo-1",
      seconds: 120,
    });

    await waitFor(() => {
      const optimisticLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      expect(optimisticLog?.todos[0]?.deviationSeconds).toBe(130);
    });

    deferred.reject(new Error("network failed"));
    await expect(mutationPromise).rejects.toThrow("network failed");

    await waitFor(() => {
      const rolledBackLog = queryClient.getQueryData<DailyLogDetail>(dailyLogByDateQueryKey(dateKey));
      const rolledBackStats = queryClient.getQueryData<DailyLogDetail>(statsDailyDetailQueryKey(dateKey));
      expect(rolledBackLog?.todos[0]?.deviationSeconds).toBe(10);
      expect(rolledBackStats?.todos[0]?.deviationSeconds).toBe(10);
    });
  });
});
