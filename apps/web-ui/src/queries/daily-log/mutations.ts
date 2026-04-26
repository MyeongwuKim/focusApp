import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTodoDeviationToDailyLog,
  addTodosToDailyLog,
  completeTodoFromDailyLog,
  deleteTodoFromDailyLog,
  type fetchDailyLogsByMonth,
  pauseTodoFromDailyLog,
  reorderTodosFromDailyLog,
  resetTodoFromDailyLog,
  resumeTodoFromDailyLog,
  startRestSession,
  startTodoFromDailyLog,
  stopRestSession,
  updateTodoActualFocusFromDailyLog,
  updateTodoScheduleFromDailyLog,
  upsertDailyLogMemo,
} from "../../api/dailyLogApi";
import {
  dailyLogByDateQueryKey,
  dailyLogMemoQueryKey,
  dailyLogsByMonthQueryKey,
  statsDailyDetailQueryKey,
} from "./queries";
import { taskCollectionsQueryKey } from "../task-collection/queries";

type AddTodosToDailyLogInput = {
  dateKey: string;
  items: Array<{
    content: string;
    taskId?: string | null;
    scheduledStartAt?: string | null;
  }>;
};

type DailyLogDetail = Awaited<ReturnType<typeof addTodosToDailyLog>>;
type MonthlyLogSnapshot = Awaited<ReturnType<typeof fetchDailyLogsByMonth>>[number];
type DailyLogTodo = DailyLogDetail["todos"][number];
type DailyLogMutationInputBase = { dateKey: string };
type DailyLogMutationCacheSnapshot = {
  dailyLogByDate: DailyLogDetail | null | undefined;
  statsDailyDetail: DailyLogDetail | null | undefined;
  monthlyEntries: Array<{ queryKey: readonly unknown[]; data: MonthlyLogSnapshot[] | undefined }>;
};
type DailyLogMutationContext = {
  dateKey: string;
  syncMonthCache: boolean;
  snapshot: DailyLogMutationCacheSnapshot;
};

function toMonthlySnapshot(payload: DailyLogDetail, previous?: MonthlyLogSnapshot): MonthlyLogSnapshot {
  const orderedTodos = [...payload.todos].sort((a, b) => a.order - b.order);
  return {
    id: previous?.id ?? `daily-log-${payload.dateKey}`,
    userId: previous?.userId ?? "",
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

function syncDailyLogDetailCaches(queryClient: QueryClient, payload: DailyLogDetail) {
  const clonedPayload = { ...payload };
  queryClient.setQueryData(dailyLogByDateQueryKey(payload.dateKey), clonedPayload);
  queryClient.setQueryData(statsDailyDetailQueryKey(payload.dateKey), clonedPayload);
}

function syncDailyLogsByMonthCache(queryClient: QueryClient, payload: DailyLogDetail) {
  const monthKey = payload.dateKey.slice(0, 7);
  let hasMatchedMonthCache = false;

  queryClient.setQueriesData(
    {
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      exact: false,
    },
    (previous) => {
      if (!Array.isArray(previous)) {
        return previous;
      }

      hasMatchedMonthCache = true;
      const previousSnapshots = previous as MonthlyLogSnapshot[];
      const targetIndex = previousSnapshots.findIndex((snapshot) => snapshot.dateKey === payload.dateKey);

      if (targetIndex < 0) {
        return [...previousSnapshots, toMonthlySnapshot(payload)].sort((a, b) =>
          a.dateKey.localeCompare(b.dateKey)
        );
      }

      return previousSnapshots.map((snapshot, index) =>
        index === targetIndex ? toMonthlySnapshot(payload, snapshot) : snapshot
      );
    }
  );

  if (!hasMatchedMonthCache) {
    void queryClient.invalidateQueries({
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      exact: false,
    });
  }
}

function syncDailyLogsByMonthCacheWithoutInvalidateOnMiss(queryClient: QueryClient, payload: DailyLogDetail) {
  const monthKey = payload.dateKey.slice(0, 7);
  queryClient.setQueriesData(
    {
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      exact: false,
    },
    (previous) => {
      if (!Array.isArray(previous)) {
        return previous;
      }

      const previousSnapshots = previous as MonthlyLogSnapshot[];
      const targetIndex = previousSnapshots.findIndex((snapshot) => snapshot.dateKey === payload.dateKey);

      if (targetIndex < 0) {
        return [...previousSnapshots, toMonthlySnapshot(payload)].sort((a, b) =>
          a.dateKey.localeCompare(b.dateKey)
        );
      }

      return previousSnapshots.map((snapshot, index) =>
        index === targetIndex ? toMonthlySnapshot(payload, snapshot) : snapshot
      );
    }
  );
}

function cloneDailyLogDetail(payload: DailyLogDetail): DailyLogDetail {
  return {
    ...payload,
    todos: payload.todos.map((todo) => ({ ...todo })),
  };
}

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function hasAnotherInProgressTodo(todos: DailyLogTodo[], targetTodoId: string) {
  return todos.some(
    (todo) => todo.id !== targetTodoId && !todo.done && Boolean(todo.startedAt) && !todo.pausedAt && !todo.completedAt
  );
}

function updateTodoById(
  payload: DailyLogDetail,
  todoId: string,
  updater: (todo: DailyLogTodo, nowIso: string) => DailyLogTodo
) {
  const targetIndex = payload.todos.findIndex((todo) => todo.id === todoId);
  if (targetIndex < 0) {
    return payload;
  }

  const nowIso = new Date().toISOString();
  const nextTodos = payload.todos.map((todo, index) =>
    index === targetIndex ? updater({ ...todo }, nowIso) : { ...todo }
  );
  return {
    ...payload,
    todos: nextTodos,
  };
}

function reorderTodosWithIds(todos: DailyLogTodo[], orderedIds: string[]) {
  const todoMap = new Map(todos.map((todo) => [todo.id, todo] as const));
  const reordered = orderedIds.map((id) => todoMap.get(id)).filter((todo): todo is DailyLogTodo => Boolean(todo));
  const remaining = todos.filter((todo) => !orderedIds.includes(todo.id));
  return [...reordered, ...remaining].map((todo, index) => ({
    ...todo,
    order: index,
  }));
}

function optimisticAddTodos(payload: DailyLogDetail, input: AddTodosToDailyLogInput): DailyLogDetail {
  const existingTaskIds = new Set(
    payload.todos
      .map((todo) => todo.taskId ?? null)
      .filter((taskId): taskId is string => typeof taskId === "string" && taskId.length > 0)
  );
  const existingContents = new Set(
    payload.todos.map((todo) => todo.content.trim().toLowerCase()).filter((content) => content.length > 0)
  );
  const nextTodos = payload.todos.map((todo) => ({ ...todo }));
  input.items.forEach((item, index) => {
    const content = item.content.trim();
    if (!content) {
      return;
    }

    const taskId = item.taskId ?? null;
    const normalizedContent = content.toLowerCase();
    if (taskId && existingTaskIds.has(taskId)) {
      return;
    }
    if (!taskId && existingContents.has(normalizedContent)) {
      return;
    }

    nextTodos.push({
      id: `optimistic-${input.dateKey}-${Date.now()}-${index}`,
      taskId,
      titleSnapshot: null,
      content,
      done: false,
      order: nextTodos.length,
      startedAt: null,
      scheduledStartAt: item.scheduledStartAt ?? null,
      pausedAt: null,
      completedAt: null,
      deviationSeconds: 0,
      actualFocusSeconds: null,
    });

    if (taskId) {
      existingTaskIds.add(taskId);
    } else {
      existingContents.add(normalizedContent);
    }
  });

  return {
    ...payload,
    todos: nextTodos,
  };
}

function optimisticDeleteTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  const nextTodos = payload.todos
    .filter((todo) => todo.id !== input.todoId)
    .map((todo, index) => ({ ...todo, order: index }));
  return {
    ...payload,
    todos: nextTodos,
  };
}

function optimisticStartTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  if (hasAnotherInProgressTodo(payload.todos, input.todoId)) {
    return payload;
  }
  return updateTodoById(payload, input.todoId, (todo, nowIso) => ({
    ...todo,
    done: false,
    startedAt: todo.startedAt ?? nowIso,
    scheduledStartAt: null,
    pausedAt: null,
    completedAt: null,
    actualFocusSeconds: null,
  }));
}

function optimisticPauseTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo, nowIso) => {
    if (todo.done || !todo.startedAt || todo.pausedAt) {
      return todo;
    }
    return {
      ...todo,
      pausedAt: nowIso,
    };
  });
}

function optimisticResumeTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  if (hasAnotherInProgressTodo(payload.todos, input.todoId)) {
    return payload;
  }

  return updateTodoById(payload, input.todoId, (todo, nowIso) => {
    if (todo.done || !todo.startedAt || !todo.pausedAt) {
      return todo;
    }
    const pausedAtMs = toEpochMillis(todo.pausedAt);
    const nowMs = toEpochMillis(nowIso) ?? Date.now();
    const pausedSeconds = pausedAtMs ? Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0) : 0;
    return {
      ...todo,
      pausedAt: null,
      scheduledStartAt: null,
      deviationSeconds: Math.max(todo.deviationSeconds + pausedSeconds, 0),
    };
  });
}

function optimisticCompleteTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo, nowIso) => {
    const nowMs = toEpochMillis(nowIso) ?? Date.now();
    const startedAtMs = toEpochMillis(todo.startedAt ?? nowIso) ?? nowMs;
    const pausedAtMs = toEpochMillis(todo.pausedAt);
    const pausedSeconds = pausedAtMs ? Math.max(Math.floor((nowMs - pausedAtMs) / 1000), 0) : 0;
    const totalElapsedSeconds = Math.max(Math.floor((nowMs - startedAtMs) / 1000), 0);
    const nextDeviationSeconds = Math.max(todo.deviationSeconds + pausedSeconds, 0);
    const actualFocusSeconds = Math.max(totalElapsedSeconds - nextDeviationSeconds, 0);
    return {
      ...todo,
      done: true,
      startedAt: todo.startedAt ?? nowIso,
      scheduledStartAt: null,
      pausedAt: null,
      completedAt: nowIso,
      deviationSeconds: nextDeviationSeconds,
      actualFocusSeconds,
    };
  });
}

function optimisticResetTodo(payload: DailyLogDetail, input: { dateKey: string; todoId: string }): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo) => ({
    ...todo,
    done: false,
    startedAt: null,
    pausedAt: null,
    completedAt: null,
    deviationSeconds: 0,
    actualFocusSeconds: null,
  }));
}

function optimisticAddDeviation(
  payload: DailyLogDetail,
  input: { dateKey: string; todoId: string; seconds: number }
): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo) => ({
    ...todo,
    deviationSeconds: Math.max(todo.deviationSeconds + Math.max(Math.floor(input.seconds), 0), 0),
  }));
}

function optimisticReorderTodos(
  payload: DailyLogDetail,
  input: { dateKey: string; todoIds: string[] }
): DailyLogDetail {
  return {
    ...payload,
    todos: reorderTodosWithIds(payload.todos, input.todoIds),
  };
}

function optimisticUpdateActualFocus(
  payload: DailyLogDetail,
  input: { dateKey: string; todoId: string; actualFocusSeconds: number }
): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo, nowIso) => {
    const nextActualFocusSeconds = Math.max(Math.floor(input.actualFocusSeconds), 0);
    const deviationSeconds = Math.max(todo.deviationSeconds, 0);
    const startedAtIso = todo.startedAt ?? todo.completedAt ?? nowIso;
    const startedAtMs = toEpochMillis(startedAtIso) ?? Date.now();
    const nextCompletedAt = new Date(startedAtMs + (nextActualFocusSeconds + deviationSeconds) * 1000).toISOString();
    return {
      ...todo,
      done: true,
      startedAt: startedAtIso,
      scheduledStartAt: null,
      pausedAt: null,
      completedAt: nextCompletedAt,
      actualFocusSeconds: nextActualFocusSeconds,
    };
  });
}

function optimisticUpdateSchedule(
  payload: DailyLogDetail,
  input: { dateKey: string; todoId: string; scheduledStartAt: string | null }
): DailyLogDetail {
  return updateTodoById(payload, input.todoId, (todo) => ({
    ...todo,
    scheduledStartAt: input.scheduledStartAt,
  }));
}

function optimisticStartRestSession(payload: DailyLogDetail): DailyLogDetail {
  if (payload.restStartedAt) {
    return payload;
  }
  return {
    ...payload,
    restStartedAt: new Date().toISOString(),
  };
}

function optimisticStopRestSession(payload: DailyLogDetail): DailyLogDetail {
  if (!payload.restStartedAt) {
    return payload;
  }
  const restStartedAtMs = toEpochMillis(payload.restStartedAt);
  const nowMs = Date.now();
  const elapsedSeconds = restStartedAtMs ? Math.max(Math.floor((nowMs - restStartedAtMs) / 1000), 0) : 0;
  return {
    ...payload,
    restAccumulatedSeconds: Math.max(payload.restAccumulatedSeconds + elapsedSeconds, 0),
    restStartedAt: null,
  };
}

function captureDailyLogMutationSnapshot(
  queryClient: QueryClient,
  dateKey: string,
  syncMonthCache: boolean
): DailyLogMutationCacheSnapshot {
  const monthKey = dateKey.slice(0, 7);
  return {
    dailyLogByDate: queryClient.getQueryData<DailyLogDetail | null>(dailyLogByDateQueryKey(dateKey)),
    statsDailyDetail: queryClient.getQueryData<DailyLogDetail | null>(statsDailyDetailQueryKey(dateKey)),
    monthlyEntries: syncMonthCache
      ? queryClient
          .getQueriesData<MonthlyLogSnapshot[] | undefined>({
            queryKey: dailyLogsByMonthQueryKey(monthKey),
            exact: false,
          })
          .map(([queryKey, data]) => ({ queryKey, data }))
      : [],
  };
}

function restoreDailyLogMutationSnapshot(queryClient: QueryClient, context: DailyLogMutationContext) {
  const { dateKey, snapshot } = context;
  if (snapshot.dailyLogByDate === undefined) {
    queryClient.removeQueries({
      queryKey: dailyLogByDateQueryKey(dateKey),
      exact: true,
    });
  } else {
    queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), snapshot.dailyLogByDate);
  }

  if (snapshot.statsDailyDetail === undefined) {
    queryClient.removeQueries({
      queryKey: statsDailyDetailQueryKey(dateKey),
      exact: true,
    });
  } else {
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), snapshot.statsDailyDetail);
  }

  snapshot.monthlyEntries.forEach(({ queryKey, data }) => {
    queryClient.setQueryData(queryKey, data);
  });
}

async function applyOptimisticDailyLogMutation<TInput extends DailyLogMutationInputBase>(
  queryClient: QueryClient,
  input: TInput,
  options: {
    syncMonthCache: boolean;
    optimisticUpdater?: (payload: DailyLogDetail, input: TInput) => DailyLogDetail;
  }
): Promise<DailyLogMutationContext> {
  const monthKey = input.dateKey.slice(0, 7);
  await queryClient.cancelQueries({
    queryKey: dailyLogByDateQueryKey(input.dateKey),
    exact: true,
  });
  await queryClient.cancelQueries({
    queryKey: statsDailyDetailQueryKey(input.dateKey),
    exact: true,
  });
  if (options.syncMonthCache) {
    await queryClient.cancelQueries({
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      exact: false,
    });
  }

  const snapshot = captureDailyLogMutationSnapshot(queryClient, input.dateKey, options.syncMonthCache);
  const basePayload = snapshot.dailyLogByDate ?? snapshot.statsDailyDetail;
  if (basePayload && options.optimisticUpdater) {
    const optimisticPayload = options.optimisticUpdater(cloneDailyLogDetail(basePayload), input);
    syncDailyLogDetailCaches(queryClient, optimisticPayload);
    if (options.syncMonthCache) {
      syncDailyLogsByMonthCacheWithoutInvalidateOnMiss(queryClient, optimisticPayload);
    }
  }

  return {
    dateKey: input.dateKey,
    syncMonthCache: options.syncMonthCache,
    snapshot,
  };
}

function useOptimisticDailyLogMutation<TInput extends DailyLogMutationInputBase>(options: {
  mutationFn: (input: TInput) => Promise<DailyLogDetail>;
  syncMonthCache?: boolean;
  optimisticUpdater?: (payload: DailyLogDetail, input: TInput) => DailyLogDetail;
  onSuccess?: (args: { data: DailyLogDetail; input: TInput; context: DailyLogMutationContext | undefined }) => void;
}) {
  const queryClient = useQueryClient();
  const syncMonthCache = options.syncMonthCache ?? false;

  return useMutation<DailyLogDetail, unknown, TInput, DailyLogMutationContext>({
    mutationFn: options.mutationFn,
    onMutate: async (input) =>
      applyOptimisticDailyLogMutation(queryClient, input, {
        syncMonthCache,
        optimisticUpdater: options.optimisticUpdater,
      }),
    onError: (_error, _input, context) => {
      if (!context) {
        return;
      }
      restoreDailyLogMutationSnapshot(queryClient, context);
      void queryClient.invalidateQueries({
        queryKey: statsDailyDetailQueryKey(context.dateKey),
        exact: true,
        refetchType: "active",
      });
      if (context.syncMonthCache) {
        void queryClient.invalidateQueries({
          queryKey: dailyLogsByMonthQueryKey(context.dateKey.slice(0, 7)),
          exact: false,
          refetchType: "active",
        });
      }
    },
    onSuccess: (data, input, context) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache,
      });
      options.onSuccess?.({ data, input, context });
    },
  });
}

function applyDailyLogMutationCacheSync(
  queryClient: QueryClient,
  payload: DailyLogDetail,
  options?: { syncMonthCache?: boolean }
) {
  syncDailyLogDetailCaches(queryClient, payload);

  if (options?.syncMonthCache) {
    syncDailyLogsByMonthCache(queryClient, payload);
  }

  // Keep the UI instantly responsive via setQueryData, then refetch only active views as a safety net.
  void queryClient.invalidateQueries({
    queryKey: statsDailyDetailQueryKey(payload.dateKey),
    exact: true,
    refetchType: "active",
  });

  if (options?.syncMonthCache) {
    const monthKey = payload.dateKey.slice(0, 7);
    void queryClient.invalidateQueries({
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      exact: false,
      refetchType: "active",
    });
  }
}

export function useUpsertDailyLogMemoMutation(dateKey: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (memo: string) => upsertDailyLogMemo({ dateKey, memo }),
    onSuccess: (data) => {
      queryClient.setQueryData(dailyLogMemoQueryKey(dateKey), data ? { ...data } : null);
      queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), (prev: any) => {
        if (!prev) {
          return prev;
        }
        return {
          ...prev,
          memo: data?.memo ?? null,
        };
      });

      queryClient.setQueriesData(
        {
          queryKey: ["daily-logs"],
          exact: false,
        },
        (prev: any) => {
          if (!Array.isArray(prev)) {
            return prev;
          }
          return prev.map((log) =>
            log?.dateKey === dateKey
              ? {
                  ...log,
                  memo: data?.memo ?? null,
                }
              : log
          );
        }
      );
    },
  });
}

export function useAddTodosToDailyLogMutation() {
  const queryClient = useQueryClient();

  return useOptimisticDailyLogMutation<AddTodosToDailyLogInput>({
    mutationFn: (input) => addTodosToDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticAddTodos,
    onSuccess: ({ input }) => {
      const hasLinkedTask = input.items.some(
        (item) => typeof item.taskId === "string" && item.taskId.trim().length > 0
      );
      if (!hasLinkedTask) {
        return;
      }
      void queryClient.invalidateQueries({
        queryKey: taskCollectionsQueryKey,
        exact: true,
        refetchType: "all",
      });
    },
  });
}

export function useDeleteTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => deleteTodoFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticDeleteTodo,
  });
}

export function useStartTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => startTodoFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticStartTodo,
  });
}

export function useCompleteTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => completeTodoFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticCompleteTodo,
  });
}

export function useResetTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => resetTodoFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticResetTodo,
  });
}

export function useAddTodoDeviationToDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string; seconds: number }>({
    mutationFn: (input) => addTodoDeviationToDailyLog(input),
    optimisticUpdater: optimisticAddDeviation,
  });
}

export function useReorderTodosMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoIds: string[] }>({
    mutationFn: (input) => reorderTodosFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticReorderTodos,
  });
}

export function useUpdateTodoActualFocusMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string; actualFocusSeconds: number }>({
    mutationFn: (input) => updateTodoActualFocusFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticUpdateActualFocus,
  });
}

export function useUpdateTodoScheduleMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string; scheduledStartAt: string | null }>({
    mutationFn: (input) => updateTodoScheduleFromDailyLog(input),
    syncMonthCache: true,
    optimisticUpdater: optimisticUpdateSchedule,
  });
}

export function usePauseTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => pauseTodoFromDailyLog(input),
    optimisticUpdater: optimisticPauseTodo,
  });
}

export function useResumeTodoFromDailyLogMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string; todoId: string }>({
    mutationFn: (input) => resumeTodoFromDailyLog(input),
    optimisticUpdater: optimisticResumeTodo,
  });
}

export function useStartRestSessionMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string }>({
    mutationFn: (input) => startRestSession(input),
    syncMonthCache: true,
    optimisticUpdater: (payload) => optimisticStartRestSession(payload),
  });
}

export function useStopRestSessionMutation() {
  return useOptimisticDailyLogMutation<{ dateKey: string }>({
    mutationFn: (input) => stopRestSession(input),
    syncMonthCache: true,
    optimisticUpdater: (payload) => optimisticStopRestSession(payload),
  });
}

export function useDailyLogMutation() {
  const addTodosMutation = useAddTodosToDailyLogMutation();
  const deleteTodoMutation = useDeleteTodoFromDailyLogMutation();
  const startTodoMutation = useStartTodoFromDailyLogMutation();
  const pauseTodoMutation = usePauseTodoFromDailyLogMutation();
  const resumeTodoMutation = useResumeTodoFromDailyLogMutation();
  const completeTodoMutation = useCompleteTodoFromDailyLogMutation();
  const resetTodoMutation = useResetTodoFromDailyLogMutation();
  const reorderTodosMutation = useReorderTodosMutation();
  const updateTodoActualFocusMutation = useUpdateTodoActualFocusMutation();
  const updateTodoScheduleMutation = useUpdateTodoScheduleMutation();
  const startRestSessionMutation = useStartRestSessionMutation();
  const stopRestSessionMutation = useStopRestSessionMutation();

  return {
    addTodosMutation,
    deleteTodoMutation,
    startTodoMutation,
    pauseTodoMutation,
    resumeTodoMutation,
    completeTodoMutation,
    resetTodoMutation,
    reorderTodosMutation,
    updateTodoActualFocusMutation,
    updateTodoScheduleMutation,
    startRestSessionMutation,
    stopRestSessionMutation,
  };
}

export function useDailyLogMemoMutation(dateKey: string) {
  const upsertDailyLogMemoMutation = useUpsertDailyLogMemoMutation(dateKey);

  return {
    upsertDailyLogMemoMutation,
  };
}
