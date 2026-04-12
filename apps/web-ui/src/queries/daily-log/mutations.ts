import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addTodoDeviationToDailyLog,
  addTodosToDailyLog,
  completeTodoFromDailyLog,
  deleteTodoFromDailyLog,
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
import { dailyLogByDateQueryKey, dailyLogMemoQueryKey } from "./queries";

type AddTodosToDailyLogInput = {
  dateKey: string;
  items: Array<{
    content: string;
    taskId?: string | null;
    scheduledStartAt?: string | null;
  }>;
};

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

      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useAddTodosToDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AddTodosToDailyLogInput) => addTodosToDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useDeleteTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => deleteTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useStartTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => startTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useCompleteTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => completeTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useResetTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => resetTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useAddTodoDeviationToDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; seconds: number }) =>
      addTodoDeviationToDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
    },
  });
}

export function useUpdateTodoActualFocusMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; actualFocusSeconds: number }) =>
      updateTodoActualFocusFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useUpdateTodoScheduleMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string; scheduledStartAt: string | null }) =>
      updateTodoScheduleFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function usePauseTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => pauseTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
    },
  });
}

export function useResumeTodoFromDailyLogMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string; todoId: string }) => resumeTodoFromDailyLog(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
    },
  });
}

export function useStartRestSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string }) => startRestSession(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
      });
    },
  });
}

export function useStopRestSessionMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: { dateKey: string }) => stopRestSession(input),
    onSuccess: (data, variables) => {
      queryClient.setQueryData(dailyLogByDateQueryKey(variables.dateKey), data ? { ...data } : null);
      void queryClient.invalidateQueries({
        queryKey: ["daily-logs"],
        exact: false,
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
