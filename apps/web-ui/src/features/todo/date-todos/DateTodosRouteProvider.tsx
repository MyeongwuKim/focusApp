import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TaskItem } from "../types";
import type { RoutineTemplate } from "../../../api/routineTemplateApi";
import { useDailyLogMutation, useDailyLogQuery, useRoutineTemplateMutation, useRoutineTemplateQuery } from "../../../queries";
import { confirm, toast, useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";
import {
  cancelNativeRestNotification,
  cancelNativeTargetFocusNotification,
  notifyRestFinished,
  scheduleNativeRestNotification,
  scheduleNativeTargetFocusNotification,
} from "../../../utils/notifications";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { useDateTodosTaskActions } from "./hooks/useDateTodosTaskActions";
import { useDateTodosRoutineActions } from "./hooks/useDateTodosRoutineActions";

type DateTodosSummary = {
  completedCount: number;
  totalCount: number;
  totalMinutes: number;
  progressPercent: number;
};

type DateTodosSession = {
  focusMinutes: number;
  restMinutes: number;
  active: "focus" | "rest" | null;
  restDurationPreviewMin: number | null;
};

type TargetFocusBaselineEntry = {
  startedAtMs: number;
  targetFocusMinutes: number;
  baselineActualFocusSeconds: number;
};

type DailyLogWithTodos = {
  todos: Array<{
    id: string;
    titleSnapshot?: string | null;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
    targetFocusMinutes: number | null;
    muteReminderDateKey: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    deviationSeconds: number;
    actualFocusSeconds: number | null;
  }>;
} | null;

type DateTodosRouteContextValue = {
  items: TaskItem[];
  isItemsHydrating: boolean;
  reorderTasksByIds: (orderedIdsValue: string[]) => void;
  handleDateTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  handleEditActualFocus: (taskId: string) => void;
  handleDateTaskMenuAction: (taskId: string) => void;

  summary: DateTodosSummary;
  session: DateTodosSession;
  toggleRestSession: (startDurationMin?: number | null) => void;

  openMemo: () => void;
  openTaskPicker: () => void;

  handleDateAddTasks: (items: Array<{ label: string; taskId?: string | null; scheduledStartAt?: string | null }>) => Promise<void>;
  openRoutineImport: () => void;
  openRoutineCreate: () => void;
  routineTemplates: RoutineTemplate[];
  isRoutineTemplatesLoading: boolean;
  handleApplyRoutineTemplate: (routineTemplateId: string) => Promise<void>;
  handleCreateRoutineTemplate: (input: {
    name: string;
    items: Array<{
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => Promise<void>;
  handleUpdateRoutineTemplate: (input: {
    routineTemplateId: string;
    items: Array<{
      id?: string;
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => Promise<void>;
  handleDeleteRoutineTemplate: (routineTemplateId: string) => Promise<void>;

  resolvedMemoDateKey: string;

  editingActualFocus: {
    taskId: string;
    initialMinutes: number;
  } | null;
  closeEditingActualFocus: () => void;
  handleSaveActualFocus: (minutes: number) => Promise<void>;
  editingScheduledStart: {
    taskId: string;
    initialTime: string;
  } | null;
  closeEditingScheduledStart: () => void;
  handleSaveScheduledStart: (time: string) => Promise<void>;
  editingTargetFocus: {
    taskId: string;
    initialMinutes: number;
  } | null;
  closeEditingTargetFocus: () => void;
  handleSaveTargetFocus: (minutes: number | null) => Promise<void>;
};

const DateTodosRouteContext = createContext<DateTodosRouteContextValue | null>(null);

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function getTodoActualFocusSecondsNow(todo: {
  startedAt: string | null;
  pausedAt: string | null;
  deviationSeconds: number;
}) {
  const startedAtMs = toEpochMillis(todo.startedAt);
  if (!startedAtMs) {
    return null;
  }
  const endMs = toEpochMillis(todo.pausedAt) ?? Date.now();
  const deviationSeconds =
    typeof todo.deviationSeconds === "number" && Number.isFinite(todo.deviationSeconds)
      ? Math.max(Math.floor(todo.deviationSeconds), 0)
      : 0;
  return Math.max(Math.floor((endMs - startedAtMs) / 1000) - deviationSeconds, 0);
}

function mapDailyLogTodosToTaskItems(
  dateKey: string,
  todayKey: string,
  todos: Array<{
    id: string;
    titleSnapshot?: string | null;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
    targetFocusMinutes: number | null;
    muteReminderDateKey: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    deviationSeconds: number;
    actualFocusSeconds: number | null;
  }>
) {
  const isPastDate = dateKey < todayKey;

  return [...todos]
    .sort((a, b) => a.order - b.order)
    .map((todo) => {
      const startedAt = toEpochMillis(todo.startedAt);
      const scheduledStartAt = toEpochMillis(todo.scheduledStartAt);
      const targetFocusMinutes = typeof todo.targetFocusMinutes === "number" ? Math.floor(todo.targetFocusMinutes) : null;
      const completedAt = toEpochMillis(todo.completedAt);
      const completedDurationMs = todo.done ? (todo.actualFocusSeconds ?? 0) * 1000 : null;
      const status: TaskItem["status"] = todo.done
        ? "done"
        : isPastDate
          ? "overdue"
          : todo.pausedAt
          ? "paused"
          : startedAt
            ? "in_progress"
            : "todo";

      return {
        id: todo.id || `${dateKey}-${todo.content}-${todo.order}`,
        label: todo.content,
        status,
        accumulatedMs: completedDurationMs ?? 0,
        startedAt,
        deviationSeconds:
          typeof todo.deviationSeconds === "number" && Number.isFinite(todo.deviationSeconds)
            ? Math.max(Math.floor(todo.deviationSeconds), 0)
            : 0,
        scheduledStartAt,
        targetFocusMinutes,
        muteReminderDateKey: todo.muteReminderDateKey ?? null,
        completedAt: status === "done" ? completedAt : null,
        completedDurationMs,
      };
    });
}

function isSameTaskItems(a: TaskItem[], b: TaskItem[]) {
  if (a.length !== b.length) {
    return false;
  }

  for (let index = 0; index < a.length; index += 1) {
    const current = a[index];
    const next = b[index];
    if (
      current.id !== next.id ||
      current.label !== next.label ||
      current.status !== next.status ||
      current.accumulatedMs !== next.accumulatedMs ||
      current.startedAt !== next.startedAt ||
      current.deviationSeconds !== next.deviationSeconds ||
      current.targetFocusBaselineSeconds !== next.targetFocusBaselineSeconds ||
      current.scheduledStartAt !== next.scheduledStartAt ||
      current.targetFocusMinutes !== next.targetFocusMinutes ||
      current.muteReminderDateKey !== next.muteReminderDateKey ||
      current.completedAt !== next.completedAt ||
      current.completedDurationMs !== next.completedDurationMs
    ) {
      return false;
    }
  }

  return true;
}

function reorderTaskItemsByIds(items: TaskItem[], orderedIdsValue: string[]) {
  const itemMap = new Map(items.map((item) => [item.id, item] as const));
  const reordered = orderedIdsValue
    .map((id) => itemMap.get(id))
    .filter((item): item is TaskItem => Boolean(item));
  const remaining = items.filter((item) => !orderedIdsValue.includes(item.id));
  return [...reordered, ...remaining];
}

export function DateTodosRouteProvider({
  dateKey,
  restFinishedRequested = false,
  focusTargetElapsedRequested = false,
  startTodoPromptRequested = false,
  focusTargetTodoId = null,
  onOpenMemo,
  onOpenTaskPicker,
  onOpenRoutineImport,
  onOpenRoutineCreate,
  children,
}: {
  dateKey: string | null;
  restFinishedRequested?: boolean;
  focusTargetElapsedRequested?: boolean;
  startTodoPromptRequested?: boolean;
  focusTargetTodoId?: string | null;
  onOpenMemo?: () => void;
  onOpenTaskPicker?: () => void;
  onOpenRoutineImport?: () => void;
  onOpenRoutineCreate?: () => void;
  children: ReactNode;
}) {
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);

  const [dateTasksRouteItems, setDateTasksRouteItems] = useState<TaskItem[]>([]);
  const [editingActualFocus, setEditingActualFocus] = useState<{
    taskId: string;
    initialMinutes: number;
  } | null>(null);
  const [editingScheduledStart, setEditingScheduledStart] = useState<{
    taskId: string;
    initialTime: string;
  } | null>(null);
  const [editingTargetFocus, setEditingTargetFocus] = useState<{
    taskId: string;
    initialMinutes: number;
  } | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [activeRestDurationMin, setActiveRestDurationMin] = useState<number | null>(null);
  const [hydratedDateKey, setHydratedDateKey] = useState<string | null>(null);

  const pendingRestFinishedAutoStopRef = useRef(false);
  const restFinishedAutoStopInFlightRef = useRef(false);
  const pendingFocusTargetPromptRef = useRef(false);
  const focusTargetPromptInFlightRef = useRef(false);
  const focusTargetPromptKeyRef = useRef<string | null>(null);
  const autoFocusTargetPromptInFlightRef = useRef(false);
  const autoFocusTargetPromptedSetRef = useRef<Set<string>>(new Set());
  const pendingStartTodoPromptRef = useRef(false);
  const startTodoPromptInFlightRef = useRef(false);
  const startTodoPromptKeyRef = useRef<string | null>(null);
  const scheduledTargetFocusNotificationKeyRef = useRef<{ dateKey: string; todoId: string } | null>(null);
  const targetFocusBaselineByTodoRef = useRef<Map<string, TargetFocusBaselineEntry>>(new Map());
  const reorderPersistRequestIdRef = useRef(0);

  const { dailyLogByDateQuery: dailyLogQuery } = useDailyLogQuery({ dateKey });
  const { routineTemplatesQuery } = useRoutineTemplateQuery();
  const {
    createRoutineTemplateMutation,
    updateRoutineTemplateMutation,
    deleteRoutineTemplateMutation,
  } = useRoutineTemplateMutation();
  const {
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
    updateTodoTargetFocusMutation,
    muteTodoReminderTodayMutation,
    unmuteTodoReminderMutation,
    startRestSessionMutation,
    stopRestSessionMutation,
  } = useDailyLogMutation();

  const startRestSessionRef = useRef(startRestSessionMutation.mutateAsync);
  const stopRestSessionRef = useRef(stopRestSessionMutation.mutateAsync);

  useEffect(() => {
    startRestSessionRef.current = startRestSessionMutation.mutateAsync;
  }, [startRestSessionMutation.mutateAsync]);

  useEffect(() => {
    stopRestSessionRef.current = stopRestSessionMutation.mutateAsync;
  }, [stopRestSessionMutation.mutateAsync]);

  useEffect(() => {
    setSelectedDateKey(dateKey);
  }, [dateKey, setSelectedDateKey]);

  useEffect(() => {
    if (!dateKey) {
      setDateTasksRouteItems([]);
      setActiveRestDurationMin(null);
      pendingRestFinishedAutoStopRef.current = false;
      restFinishedAutoStopInFlightRef.current = false;
      pendingFocusTargetPromptRef.current = false;
      focusTargetPromptInFlightRef.current = false;
      focusTargetPromptKeyRef.current = null;
      autoFocusTargetPromptInFlightRef.current = false;
      autoFocusTargetPromptedSetRef.current.clear();
      pendingStartTodoPromptRef.current = false;
      startTodoPromptInFlightRef.current = false;
      startTodoPromptKeyRef.current = null;
      targetFocusBaselineByTodoRef.current.clear();
      setHydratedDateKey(null);
      return;
    }

    setDateTasksRouteItems([]);
    setActiveRestDurationMin(null);
    pendingRestFinishedAutoStopRef.current = false;
    restFinishedAutoStopInFlightRef.current = false;
    pendingFocusTargetPromptRef.current = false;
    focusTargetPromptInFlightRef.current = false;
    focusTargetPromptKeyRef.current = null;
    autoFocusTargetPromptInFlightRef.current = false;
    autoFocusTargetPromptedSetRef.current.clear();
    pendingStartTodoPromptRef.current = false;
    startTodoPromptInFlightRef.current = false;
    startTodoPromptKeyRef.current = null;
    targetFocusBaselineByTodoRef.current.clear();
    setHydratedDateKey(null);
  }, [dateKey]);

  const applyTargetFocusBaselines = useCallback((
    nextItems: TaskItem[],
    sourceTodos?: NonNullable<DailyLogWithTodos>["todos"]
  ): TaskItem[] => {
    if (nextItems.length === 0) {
      targetFocusBaselineByTodoRef.current.clear();
      return nextItems;
    }

    const todoById = new Map((sourceTodos ?? []).map((todo) => [todo.id, todo] as const));
    const activeIds = new Set(nextItems.map((item) => item.id));
    const baselineMap = targetFocusBaselineByTodoRef.current;

    for (const todoId of Array.from(baselineMap.keys())) {
      if (!activeIds.has(todoId)) {
        baselineMap.delete(todoId);
        continue;
      }
      const sourceTodo = todoById.get(todoId);
      if (!sourceTodo) {
        baselineMap.delete(todoId);
        continue;
      }
      const startedAtMs = toEpochMillis(sourceTodo.startedAt);
      const targetMinutes =
        typeof sourceTodo.targetFocusMinutes === "number" && Number.isFinite(sourceTodo.targetFocusMinutes)
          ? Math.floor(sourceTodo.targetFocusMinutes)
          : null;
      const baseline = baselineMap.get(todoId);
      if (!startedAtMs || !targetMinutes || !baseline) {
        baselineMap.delete(todoId);
        continue;
      }
      if (baseline.startedAtMs !== startedAtMs || baseline.targetFocusMinutes !== targetMinutes) {
        baselineMap.delete(todoId);
      }
    }

    return nextItems.map((item) => {
      const sourceTodo = todoById.get(item.id);
      if (!sourceTodo || !item.targetFocusMinutes || !item.startedAt) {
        return { ...item, targetFocusBaselineSeconds: undefined };
      }

      const baseline = baselineMap.get(item.id);
      if (!baseline) {
        return { ...item, targetFocusBaselineSeconds: undefined };
      }

      if (
        baseline.startedAtMs !== item.startedAt ||
        baseline.targetFocusMinutes !== item.targetFocusMinutes
      ) {
        baselineMap.delete(item.id);
        return { ...item, targetFocusBaselineSeconds: undefined };
      }

      return {
        ...item,
        targetFocusBaselineSeconds: baseline.baselineActualFocusSeconds,
      };
    });
  }, []);

  const updateTargetFocusBaseline = useCallback((input: {
    todoId: string;
    targetFocusMinutes: number | null;
    startedAt: number | null;
    baselineActualFocusSeconds: number;
  }) => {
    const baselineMap = targetFocusBaselineByTodoRef.current;
    if (!input.targetFocusMinutes || !input.startedAt) {
      baselineMap.delete(input.todoId);
      return;
    }

    baselineMap.set(input.todoId, {
      startedAtMs: input.startedAt,
      targetFocusMinutes: input.targetFocusMinutes,
      baselineActualFocusSeconds: Math.max(Math.floor(input.baselineActualFocusSeconds), 0),
    });
  }, []);

  useEffect(() => {
    const previous = scheduledTargetFocusNotificationKeyRef.current;
    if (!dateKey) {
      if (previous) {
        cancelNativeTargetFocusNotification(previous);
        scheduledTargetFocusNotificationKeyRef.current = null;
      }
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    const inProgressWithTarget = todos.find(
      (todo) =>
        !todo.done &&
        Boolean(todo.startedAt) &&
        !todo.pausedAt &&
        typeof todo.targetFocusMinutes === "number" &&
        Number.isFinite(todo.targetFocusMinutes) &&
        Math.floor(todo.targetFocusMinutes) >= 1
    );

    if (!inProgressWithTarget || !inProgressWithTarget.startedAt) {
      if (previous) {
        cancelNativeTargetFocusNotification(previous);
        scheduledTargetFocusNotificationKeyRef.current = null;
      }
      return;
    }

    const startedAtMs = toEpochMillis(inProgressWithTarget.startedAt);
    if (!startedAtMs) {
      if (previous) {
        cancelNativeTargetFocusNotification(previous);
        scheduledTargetFocusNotificationKeyRef.current = null;
      }
      return;
    }

    const nextKey = {
      dateKey,
      todoId: inProgressWithTarget.id,
    };
    if (
      previous &&
      (previous.dateKey !== nextKey.dateKey || previous.todoId !== nextKey.todoId)
    ) {
      cancelNativeTargetFocusNotification(previous);
    }

    const targetSeconds = Math.max(Math.floor((inProgressWithTarget.targetFocusMinutes ?? 0) * 60), 0);
    const actualFocusSeconds = getTodoActualFocusSecondsNow(inProgressWithTarget) ?? 0;
    const baseline = targetFocusBaselineByTodoRef.current.get(inProgressWithTarget.id);
    const baselineSeconds =
      baseline &&
      baseline.startedAtMs === startedAtMs &&
      baseline.targetFocusMinutes === Math.floor(inProgressWithTarget.targetFocusMinutes ?? 0)
        ? baseline.baselineActualFocusSeconds
        : 0;
    const effectiveActualFocusSeconds = Math.max(actualFocusSeconds - baselineSeconds, 0);
    const remainingSeconds = Math.max(targetSeconds - effectiveActualFocusSeconds, 0);

    scheduleNativeTargetFocusNotification({
      dateKey,
      todoId: inProgressWithTarget.id,
      seconds: Math.max(remainingSeconds, 1),
      taskLabel: inProgressWithTarget.titleSnapshot ?? inProgressWithTarget.content,
      targetFocusMinutes: inProgressWithTarget.targetFocusMinutes,
    });
    scheduledTargetFocusNotificationKeyRef.current = nextKey;
  }, [dateKey, dailyLogQuery.data?.todos]);

  useEffect(() => {
    if (!dateKey || !restFinishedRequested) {
      return;
    }
    pendingRestFinishedAutoStopRef.current = true;
  }, [dateKey, restFinishedRequested]);

  useEffect(() => {
    if (!dateKey || !focusTargetElapsedRequested || !focusTargetTodoId) {
      return;
    }

    const promptKey = `${dateKey}:${focusTargetTodoId}`;
    if (focusTargetPromptKeyRef.current === promptKey) {
      return;
    }

    focusTargetPromptKeyRef.current = promptKey;
    pendingFocusTargetPromptRef.current = true;
  }, [dateKey, focusTargetElapsedRequested, focusTargetTodoId]);

  useEffect(() => {
    if (!dateKey || !startTodoPromptRequested || !focusTargetTodoId) {
      return;
    }

    const promptKey = `${dateKey}:${focusTargetTodoId}`;
    if (startTodoPromptKeyRef.current === promptKey) {
      return;
    }

    startTodoPromptKeyRef.current = promptKey;
    pendingStartTodoPromptRef.current = true;
  }, [dateKey, startTodoPromptRequested, focusTargetTodoId]);

  useEffect(() => {
    if (!dateKey || !dailyLogQuery.isSuccess) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    const mappedItems = mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), todos);
    const nextItems = applyTargetFocusBaselines(mappedItems, todos);
    setDateTasksRouteItems((previous) => (isSameTaskItems(previous, nextItems) ? previous : nextItems));
    setHydratedDateKey(dateKey);
  }, [applyTargetFocusBaselines, dateKey, dailyLogQuery.data, dailyLogQuery.isSuccess]);

  const restStartedAtMs = useMemo(() => {
    const value = dailyLogQuery.data?.restStartedAt ?? null;
    if (!value) {
      return null;
    }
    const epoch = new Date(value).getTime();
    return Number.isFinite(epoch) ? epoch : null;
  }, [dailyLogQuery.data?.restStartedAt]);

  const hasInProgressTask = useMemo(
    () => dateTasksRouteItems.some((item) => item.status === "in_progress"),
    [dateTasksRouteItems]
  );

  const isRestActive = Boolean(restStartedAtMs);

  useEffect(() => {
    if (!hasInProgressTask && !restStartedAtMs) {
      return;
    }
    const timer = window.setInterval(() => {
      setLiveTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [hasInProgressTask, restStartedAtMs]);

  useEffect(() => {
    if (!isRestActive && activeRestDurationMin !== null) {
      setActiveRestDurationMin(null);
    }
  }, [activeRestDurationMin, isRestActive]);

  const reorderTasksByIds = (orderedIdsValue: string[]) => {
    if (!dateKey) {
      return;
    }

    const nextItems = reorderTaskItemsByIds(dateTasksRouteItems, orderedIdsValue);
    setDateTasksRouteItems(nextItems);

    const requestId = reorderPersistRequestIdRef.current + 1;
    reorderPersistRequestIdRef.current = requestId;

    void (async () => {
      try {
        const nextLog = await reorderTodosMutation.mutateAsync({
          dateKey,
          todoIds: nextItems.map((item) => item.id),
        });
        if (requestId !== reorderPersistRequestIdRef.current) {
          return;
        }
        applyDailyLog(nextLog);
      } catch (error) {
        if (requestId !== reorderPersistRequestIdRef.current) {
          return;
        }
        const message = getUserFacingErrorMessage(error, "할일 순서 저장 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "순서 저장 실패",
          message,
          duration: 2200,
        });
        void dailyLogQuery.refetch();
      }
    })();
  };

  const applyDailyLog = (nextLog: DailyLogWithTodos) => {
    if (!dateKey) {
      return;
    }
    const todos = nextLog?.todos ?? [];
    const mappedItems = mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), todos);
    setDateTasksRouteItems(applyTargetFocusBaselines(mappedItems, todos));
    setHydratedDateKey(dateKey);
  };

  const toggleRestSession = (startDurationMin?: number | null) => {
    if (!dateKey) {
      return;
    }

    if (hasInProgressTask && !isRestActive) {
      toast.show({
        type: "error",
        title: "휴식 시작 불가",
        message: "진행 중인 할일을 먼저 중단해 주세요.",
        duration: 1800,
      });
      return;
    }

    void (async () => {
      try {
        if (isRestActive) {
          const nextLog = await stopRestSessionRef.current({ dateKey });
          applyDailyLog(nextLog);
          setActiveRestDurationMin(null);
          cancelNativeRestNotification(dateKey);
        } else {
          const nextLog = await startRestSessionRef.current({ dateKey });
          applyDailyLog(nextLog);
          setActiveRestDurationMin(startDurationMin ?? null);
          if (startDurationMin === null || startDurationMin === undefined) {
            cancelNativeRestNotification(dateKey);
          }
        }
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "휴식 상태 업데이트 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "업데이트 실패",
          message,
          duration: 2200,
        });
      }
    })();
  };

  useEffect(() => {
    if (!dateKey) {
      return;
    }

    if (!isRestActive || !restStartedAtMs || activeRestDurationMin === null) {
      cancelNativeRestNotification(dateKey);
      return;
    }

    const restLimitMs = activeRestDurationMin * 60 * 1000;
    const elapsedMs = Date.now() - restStartedAtMs;
    const remainingMs = restLimitMs - elapsedMs;

    scheduleNativeRestNotification({
      dateKey,
      seconds: Math.max(Math.ceil(remainingMs / 1000), 1),
    });
  }, [activeRestDurationMin, dateKey, isRestActive, restStartedAtMs]);

  useEffect(() => {
    if (!dateKey || !isRestActive || !restStartedAtMs || activeRestDurationMin === null) {
      return;
    }

    const restLimitMs = activeRestDurationMin * 60 * 1000;
    const elapsedMs = Date.now() - restStartedAtMs;
    const remainingMs = restLimitMs - elapsedMs;

    const stopAndNotify = async () => {
      const nextLog = await stopRestSessionRef.current({ dateKey });
      applyDailyLog(nextLog);
      setActiveRestDurationMin(null);
      cancelNativeRestNotification(dateKey);
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
      notifyRestFinished(dateKey);
    };

    if (remainingMs <= 0) {
      void (async () => {
        try {
          await stopAndNotify();
        } catch {
          // 다음 렌더 주기에서 재시도
        }
      })();
      return;
    }

    const timerId = window.setTimeout(() => {
      void (async () => {
        try {
          await stopAndNotify();
        } catch {
          // 다음 렌더 주기에서 재시도
        }
      })();
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [activeRestDurationMin, dateKey, isRestActive, restStartedAtMs]);

  useEffect(() => {
    if (!dateKey || !pendingRestFinishedAutoStopRef.current || restFinishedAutoStopInFlightRef.current) {
      return;
    }

    if (!dailyLogQuery.isSuccess || !hydratedDateKey || hydratedDateKey !== dateKey) {
      return;
    }

    if (!isRestActive) {
      pendingRestFinishedAutoStopRef.current = false;
      return;
    }

    restFinishedAutoStopInFlightRef.current = true;
    void (async () => {
      try {
        const nextLog = await stopRestSessionRef.current({ dateKey });
        applyDailyLog(nextLog);
        setActiveRestDurationMin(null);
        cancelNativeRestNotification(dateKey);
      } catch {
        // 다음 렌더 주기에서 자동 재시도
      } finally {
        restFinishedAutoStopInFlightRef.current = false;
      }
    })();
  }, [dailyLogQuery.isSuccess, dateKey, hydratedDateKey, isRestActive]);

  useEffect(() => {
    if (!dateKey || !focusTargetTodoId || !pendingFocusTargetPromptRef.current || focusTargetPromptInFlightRef.current) {
      return;
    }

    if (!dailyLogQuery.isSuccess || !hydratedDateKey || hydratedDateKey !== dateKey) {
      return;
    }

    const target = dateTasksRouteItems.find((item) => item.id === focusTargetTodoId);
    if (!target || target.status === "done" || target.status === "overdue") {
      pendingFocusTargetPromptRef.current = false;
      return;
    }

    focusTargetPromptInFlightRef.current = true;
    void (async () => {
      try {
        const selected = await confirm({
          title: "목표 집중시간이 끝났어요",
          message: `${target.label}을(를) 더 이어갈까요? 아니면 완료 처리할까요?`,
          buttons: [
            { label: "이어가기", value: "continue", tone: "neutral" },
            { label: "완료 처리", value: "complete", tone: "primary" },
          ],
        });

        if (selected === "complete") {
          const nextLog = await completeTodoMutation.mutateAsync({ dateKey, todoId: target.id });
          applyDailyLog(nextLog);
          toast.show({
            type: "positive",
            title: "완료 처리됨",
            message: "목표 시간 도달 작업을 완료로 표시했어요.",
            duration: 1800,
          });
        }
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "목표 시간 처리 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "처리 실패",
          message,
          duration: 2200,
        });
      } finally {
        pendingFocusTargetPromptRef.current = false;
        focusTargetPromptInFlightRef.current = false;
      }
    })();
  }, [
    completeTodoMutation,
    dailyLogQuery.isSuccess,
    dateKey,
    dateTasksRouteItems,
    focusTargetTodoId,
    hydratedDateKey,
  ]);

  useEffect(() => {
    if (!dateKey || focusTargetPromptInFlightRef.current || autoFocusTargetPromptInFlightRef.current) {
      return;
    }
    if (pendingFocusTargetPromptRef.current || pendingStartTodoPromptRef.current) {
      return;
    }
    if (!dailyLogQuery.isSuccess || !hydratedDateKey || hydratedDateKey !== dateKey) {
      return;
    }

    const todayKey = formatDateKey(new Date());
    if (dateKey !== todayKey) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    const targetTodo = todos.find((todo) => {
      if (todo.done || todo.completedAt || !todo.startedAt || todo.pausedAt) {
        return false;
      }
      const targetMinutes =
        typeof todo.targetFocusMinutes === "number" && Number.isFinite(todo.targetFocusMinutes)
          ? Math.floor(todo.targetFocusMinutes)
          : null;
      if (!targetMinutes || targetMinutes < 1) {
        return false;
      }
      const startedAtMs = toEpochMillis(todo.startedAt);
      if (!startedAtMs) {
        return false;
      }
      const actualFocusSeconds = getTodoActualFocusSecondsNow(todo);
      if (actualFocusSeconds === null) {
        return false;
      }
      const baseline = targetFocusBaselineByTodoRef.current.get(todo.id);
      const baselineSeconds =
        baseline && baseline.startedAtMs === startedAtMs && baseline.targetFocusMinutes === targetMinutes
          ? baseline.baselineActualFocusSeconds
          : 0;
      const effectiveActualFocusSeconds = Math.max(actualFocusSeconds - baselineSeconds, 0);
      const remainingSeconds = targetMinutes * 60 - effectiveActualFocusSeconds;
      return remainingSeconds <= 0;
    });

    if (!targetTodo) {
      return;
    }

    const promptKey = `${dateKey}:${targetTodo.id}:${targetTodo.startedAt ?? ""}:${targetTodo.targetFocusMinutes ?? 0}`;
    if (autoFocusTargetPromptedSetRef.current.has(promptKey)) {
      return;
    }

    autoFocusTargetPromptedSetRef.current.add(promptKey);
    autoFocusTargetPromptInFlightRef.current = true;
    void (async () => {
      try {
        const selected = await confirm({
          title: "목표 집중시간이 끝났어요",
          message: `${targetTodo.content}을(를) 완료 처리할까요?`,
          buttons: [
            { label: "아니요", value: "continue", tone: "neutral" },
            { label: "예", value: "complete", tone: "primary" },
          ],
        });

        if (selected !== "complete") {
          return;
        }

        const nextLog = await completeTodoMutation.mutateAsync({ dateKey, todoId: targetTodo.id });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "완료 처리됨",
          message: "목표 시간 도달 작업을 완료로 표시했어요.",
          duration: 1800,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "목표 시간 처리 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "처리 실패",
          message,
          duration: 2200,
        });
      } finally {
        autoFocusTargetPromptInFlightRef.current = false;
      }
    })();
  }, [completeTodoMutation, dailyLogQuery.data?.todos, dailyLogQuery.isSuccess, dateKey, hydratedDateKey, liveTick]);

  useEffect(() => {
    if (!dateKey || !focusTargetTodoId || !pendingStartTodoPromptRef.current || startTodoPromptInFlightRef.current) {
      return;
    }

    if (!dailyLogQuery.isSuccess || !hydratedDateKey || hydratedDateKey !== dateKey) {
      return;
    }

    const target = dateTasksRouteItems.find((item) => item.id === focusTargetTodoId);
    if (!target || target.status === "done" || target.status === "overdue" || target.status === "in_progress") {
      pendingStartTodoPromptRef.current = false;
      return;
    }

    startTodoPromptInFlightRef.current = true;
    void (async () => {
      try {
        const selected = await confirm({
          title: "지금 집중 시작할까요?",
          message: `${target.label}을(를) 바로 진행할까요?`,
          buttons: [
            { label: "아니요", value: "cancel", tone: "neutral" },
            { label: "오늘은 그만", value: "mute_today", tone: "neutral" },
            { label: "예", value: "start", tone: "primary" },
          ],
        });

        if (selected === "mute_today") {
          const nextLog = await muteTodoReminderTodayMutation.mutateAsync({
            dateKey,
            todoId: target.id,
          });
          applyDailyLog(nextLog);
          toast.show({
            type: "positive",
            title: "오늘 리마인드 중지",
            message: `${target.label} 알림을 오늘은 보내지 않아요.`,
            duration: 1800,
          });
          return;
        }

        if (selected !== "start") {
          return;
        }

        const nextLog =
          target.status === "paused"
            ? await resumeTodoMutation.mutateAsync({ dateKey, todoId: target.id })
            : await startTodoMutation.mutateAsync({ dateKey, todoId: target.id });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "집중 시작",
          message: `${target.label}을(를) 시작했어요.`,
          duration: 1800,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "집중 시작 처리 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "시작 실패",
          message,
          duration: 2200,
        });
      } finally {
        pendingStartTodoPromptRef.current = false;
        startTodoPromptInFlightRef.current = false;
      }
    })();
  }, [
    dailyLogQuery.isSuccess,
    dateKey,
    dateTasksRouteItems,
    focusTargetTodoId,
    hydratedDateKey,
    muteTodoReminderTodayMutation,
    resumeTodoMutation,
    startTodoMutation,
  ]);

  const {
    handleDateTaskAction,
    handleEditActualFocus,
    handleSaveActualFocus,
    handleSaveTargetFocus,
    handleSaveScheduledStart,
    handleDateAddTasks,
    handleDateTaskMenuAction,
  } = useDateTodosTaskActions({
    dateKey,
    items: dateTasksRouteItems,
    isRestActive,
    applyDailyLog,
    stopRestSessionRef,
    setActiveRestDurationMin,
    editingActualFocus,
    setEditingActualFocus,
    editingScheduledStart,
    setEditingScheduledStart,
    editingTargetFocus,
    setEditingTargetFocus,
    addTodos: addTodosMutation.mutateAsync,
    deleteTodo: deleteTodoMutation.mutateAsync,
    startTodo: startTodoMutation.mutateAsync,
    pauseTodo: pauseTodoMutation.mutateAsync,
    resumeTodo: resumeTodoMutation.mutateAsync,
    completeTodo: completeTodoMutation.mutateAsync,
    resetTodo: resetTodoMutation.mutateAsync,
    updateTodoActualFocus: updateTodoActualFocusMutation.mutateAsync,
    updateTodoSchedule: updateTodoScheduleMutation.mutateAsync,
    updateTodoTargetFocus: updateTodoTargetFocusMutation.mutateAsync,
    updateTargetFocusBaseline,
    muteTodoReminderToday: muteTodoReminderTodayMutation.mutateAsync,
    unmuteTodoReminder: unmuteTodoReminderMutation.mutateAsync,
  });

  const {
    handleApplyRoutineTemplate,
    handleCreateRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,
  } = useDateTodosRoutineActions({
    dateKey,
    routineTemplates: routineTemplatesQuery.data ?? [],
    handleDateAddTasks,
    createRoutineTemplate: createRoutineTemplateMutation.mutateAsync,
    updateRoutineTemplate: updateRoutineTemplateMutation.mutateAsync,
    deleteRoutineTemplate: deleteRoutineTemplateMutation.mutateAsync,
  });

  const summary = useMemo(() => {
    const totalCount = dateTasksRouteItems.length;
    const completedItems = dateTasksRouteItems.filter((item) => item.status === "done");
    const completedCount = completedItems.length;
    const completedMs = completedItems.reduce(
      (acc, item) => acc + (item.completedDurationMs ?? item.accumulatedMs),
      0
    );
    const totalMinutes = Math.round(completedMs / 60000);
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return { totalCount, completedCount, totalMinutes, progressPercent };
  }, [dateTasksRouteItems]);

  const isItemsHydrating = useMemo(() => {
    if (!dateKey) {
      return false;
    }
    if (dailyLogQuery.isError) {
      return false;
    }
    return hydratedDateKey !== dateKey;
  }, [dateKey, dailyLogQuery.isError, hydratedDateKey]);

  const session = useMemo(() => {
    const nowMs = Date.now();
    const todos = dailyLogQuery.data?.todos ?? [];
    const focusSeconds = todos.reduce((acc, todo) => {
      if (todo.done) {
        return acc + Math.max(todo.actualFocusSeconds ?? 0, 0);
      }

      const startedAt = toEpochMillis(todo.startedAt);
      if (!startedAt) {
        return acc;
      }

      const pausedAt = toEpochMillis(todo.pausedAt);
      const endMs = pausedAt ?? nowMs;
      const elapsedSeconds = Math.max(Math.floor((endMs - startedAt) / 1000), 0);
      return acc + elapsedSeconds;
    }, 0);

    const restAccumulatedSeconds = Math.max(dailyLogQuery.data?.restAccumulatedSeconds ?? 0, 0);
    const activeRestSeconds = restStartedAtMs ? Math.max(Math.floor((nowMs - restStartedAtMs) / 1000), 0) : 0;
    return {
      active: isRestActive ? ("rest" as const) : hasInProgressTask ? ("focus" as const) : null,
      focusMinutes: Math.max(Math.round(focusSeconds / 60), 0),
      restMinutes: Math.floor(((restAccumulatedSeconds + activeRestSeconds) * 1000) / 60000),
      restDurationPreviewMin: isRestActive ? activeRestDurationMin : null,
    };
  }, [
    activeRestDurationMin,
    dailyLogQuery.data?.restAccumulatedSeconds,
    dailyLogQuery.data?.todos,
    hasInProgressTask,
    isRestActive,
    restStartedAtMs,
    liveTick,
  ]);

  const resolvedMemoDateKey = useMemo(() => {
    if (dateKey) {
      return dateKey;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, [dateKey]);

  const value: DateTodosRouteContextValue = {
    items: dateTasksRouteItems,
    isItemsHydrating,
    reorderTasksByIds,
    handleDateTaskAction,
    handleEditActualFocus,
    handleDateTaskMenuAction,

    summary,
    session,
    toggleRestSession,

    openMemo: () => onOpenMemo?.(),
    openTaskPicker: () => onOpenTaskPicker?.(),

    handleDateAddTasks,
    openRoutineImport: () => onOpenRoutineImport?.(),
    openRoutineCreate: () => onOpenRoutineCreate?.(),
    routineTemplates: routineTemplatesQuery.data ?? [],
    isRoutineTemplatesLoading: routineTemplatesQuery.isLoading,
    handleApplyRoutineTemplate,
    handleCreateRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,

    resolvedMemoDateKey,

    editingActualFocus,
    closeEditingActualFocus: () => setEditingActualFocus(null),
    handleSaveActualFocus,
    editingScheduledStart,
    closeEditingScheduledStart: () => setEditingScheduledStart(null),
    handleSaveScheduledStart,
    editingTargetFocus,
    closeEditingTargetFocus: () => setEditingTargetFocus(null),
    handleSaveTargetFocus,
  };

  return <DateTodosRouteContext.Provider value={value}>{children}</DateTodosRouteContext.Provider>;
}

export function useDateTodosRouteContext() {
  const context = useContext(DateTodosRouteContext);
  if (!context) {
    throw new Error("useDateTodosRouteContext must be used within DateTodosRouteProvider");
  }
  return context;
}
