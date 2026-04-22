import type { QueryClient } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTodoDeviationToDailyLog,
  addTodosToDailyLog,
  completeTodoFromDailyLog,
  deleteTodoFromDailyLog,
  type fetchDailyLogsByMonth,
  pauseTodoFromDailyLog,
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

function applyDailyLogMutationCacheSync(
  queryClient: QueryClient,
  payload: DailyLogDetail,
  options?: { syncMonthCache?: boolean }
) {
  syncDailyLogDetailCaches(queryClient, payload);

  if (options?.syncMonthCache) {
    syncDailyLogsByMonthCache(queryClient, payload);
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

  return useMutation({
    mutationFn: (input: AddTodosToDailyLogInput) => addTodosToDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useDeleteTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => deleteTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useStartTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => startTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useCompleteTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => completeTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useResetTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => resetTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useAddTodoDeviationToDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; seconds: number }) =>
      addTodoDeviationToDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data);
    },
  });
}

export function useUpdateTodoActualFocusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; actualFocusSeconds: number }) =>
      updateTodoActualFocusFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useUpdateTodoScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; scheduledStartAt: string | null }) =>
      updateTodoScheduleFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function usePauseTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => pauseTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data);
    },
  });
}

export function useResumeTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => resumeTodoFromDailyLog(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data);
    },
  });
}

export function useStartRestSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string }) => startRestSession(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
  });
}

export function useStopRestSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string }) => stopRestSession(input),
    onSuccess: (data) => {
      applyDailyLogMutationCacheSync(queryClient, data, {
        syncMonthCache: true,
      });
    },
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
