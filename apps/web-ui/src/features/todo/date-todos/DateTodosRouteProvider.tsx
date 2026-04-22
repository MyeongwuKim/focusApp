import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { TaskItem } from "../types";
import type { RoutineTemplate } from "../../../api/routineTemplateApi";
import { useDailyLogMutation, useDailyLogQuery, useRoutineTemplateMutation, useRoutineTemplateQuery } from "../../../queries";
import { toast, useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";
import { cancelNativeRestNotification, notifyRestFinished, scheduleNativeRestNotification } from "../../../utils/notifications";
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

type DailyLogWithTodos = {
  todos: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
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

  shouldRenderCompletionPanel: boolean;
  isCompletionPanelVisible: boolean;
  closeCompletionPanel: () => void;

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
};

const DateTodosRouteContext = createContext<DateTodosRouteContextValue | null>(null);

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function mapDailyLogTodosToTaskItems(
  dateKey: string,
  todayKey: string,
  todos: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
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
        startedAt: status === "in_progress" ? startedAt : null,
        scheduledStartAt,
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
      current.scheduledStartAt !== next.scheduledStartAt ||
      current.completedAt !== next.completedAt ||
      current.completedDurationMs !== next.completedDurationMs
    ) {
      return false;
    }
  }

  return true;
}

export function DateTodosRouteProvider({
  dateKey,
  restFinishedRequested = false,
  onOpenMemo,
  onOpenTaskPicker,
  onOpenRoutineImport,
  onOpenRoutineCreate,
  children,
}: {
  dateKey: string | null;
  restFinishedRequested?: boolean;
  onOpenMemo?: () => void;
  onOpenTaskPicker?: () => void;
  onOpenRoutineImport?: () => void;
  onOpenRoutineCreate?: () => void;
  children: ReactNode;
}) {
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);

  const [dateTasksRouteItems, setDateTasksRouteItems] = useState<TaskItem[]>([]);
  const [isCompletionPanelOpen, setIsCompletionPanelOpen] = useState(false);
  const [shouldRenderCompletionPanel, setShouldRenderCompletionPanel] = useState(false);
  const [isCompletionPanelVisible, setIsCompletionPanelVisible] = useState(false);
  const [editingActualFocus, setEditingActualFocus] = useState<{
    taskId: string;
    initialMinutes: number;
  } | null>(null);
  const [editingScheduledStart, setEditingScheduledStart] = useState<{
    taskId: string;
    initialTime: string;
  } | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [activeRestDurationMin, setActiveRestDurationMin] = useState<number | null>(null);
  const [hydratedDateKey, setHydratedDateKey] = useState<string | null>(null);

  const wasAllDoneRef = useRef(false);
  const completionWatchReadyRef = useRef(false);
  const pendingRestFinishedAutoStopRef = useRef(false);
  const restFinishedAutoStopInFlightRef = useRef(false);

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
    updateTodoActualFocusMutation,
    updateTodoScheduleMutation,
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
      setIsCompletionPanelOpen(false);
      wasAllDoneRef.current = false;
      completionWatchReadyRef.current = false;
      pendingRestFinishedAutoStopRef.current = false;
      restFinishedAutoStopInFlightRef.current = false;
      setHydratedDateKey(null);
      return;
    }

    setDateTasksRouteItems([]);
    setActiveRestDurationMin(null);
    setIsCompletionPanelOpen(false);
    wasAllDoneRef.current = false;
    completionWatchReadyRef.current = false;
    pendingRestFinishedAutoStopRef.current = false;
    restFinishedAutoStopInFlightRef.current = false;
    setHydratedDateKey(null);
  }, [dateKey]);

  useEffect(() => {
    if (!dateKey || !restFinishedRequested) {
      return;
    }
    pendingRestFinishedAutoStopRef.current = true;
  }, [dateKey, restFinishedRequested]);

  useEffect(() => {
    if (!dateKey || !dailyLogQuery.isSuccess) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    const nextItems = mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), todos);
    setDateTasksRouteItems((previous) => (isSameTaskItems(previous, nextItems) ? previous : nextItems));
    setHydratedDateKey(dateKey);
  }, [dateKey, dailyLogQuery.data, dailyLogQuery.isSuccess]);

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
    setDateTasksRouteItems((prevItems) => {
      const itemMap = new Map(prevItems.map((item) => [item.id, item]));
      const reordered = orderedIdsValue
        .map((id) => itemMap.get(id))
        .filter((item): item is TaskItem => Boolean(item));
      const remaining = prevItems.filter((item) => !orderedIdsValue.includes(item.id));
      return [...reordered, ...remaining];
    });
  };

  useEffect(() => {
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    if (isCompletionPanelOpen) {
      setShouldRenderCompletionPanel(true);
      rafId = window.requestAnimationFrame(() => {
        setIsCompletionPanelVisible(true);
      });
    } else {
      setIsCompletionPanelVisible(false);
      timeoutId = window.setTimeout(() => {
        setShouldRenderCompletionPanel(false);
      }, 220);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isCompletionPanelOpen]);

  const applyDailyLog = (nextLog: DailyLogWithTodos) => {
    if (!dateKey) {
      return;
    }
    setDateTasksRouteItems(
      mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), nextLog?.todos ?? [])
    );
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

  const {
    handleDateTaskAction,
    handleEditActualFocus,
    handleSaveActualFocus,
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
    addTodos: addTodosMutation.mutateAsync,
    deleteTodo: deleteTodoMutation.mutateAsync,
    startTodo: startTodoMutation.mutateAsync,
    pauseTodo: pauseTodoMutation.mutateAsync,
    resumeTodo: resumeTodoMutation.mutateAsync,
    completeTodo: completeTodoMutation.mutateAsync,
    resetTodo: resetTodoMutation.mutateAsync,
    updateTodoActualFocus: updateTodoActualFocusMutation.mutateAsync,
    updateTodoSchedule: updateTodoScheduleMutation.mutateAsync,
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

  useEffect(() => {
    const isAllDone = summary.totalCount > 0 && summary.completedCount === summary.totalCount;

    if (!completionWatchReadyRef.current) {
      completionWatchReadyRef.current = true;
      wasAllDoneRef.current = isAllDone;
      return;
    }

    if (isAllDone && !wasAllDoneRef.current) {
      setIsCompletionPanelOpen(true);
    }
    wasAllDoneRef.current = isAllDone;
  }, [summary.completedCount, summary.totalCount]);

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
      return acc + Math.max(elapsedSeconds - Math.max(todo.deviationSeconds, 0), 0);
    }, 0);

    const restAccumulatedSeconds = Math.max(dailyLogQuery.data?.restAccumulatedSeconds ?? 0, 0);
    const activeRestSeconds = restStartedAtMs ? Math.max(Math.floor((nowMs - restStartedAtMs) / 1000), 0) : 0;

    return {
      active: isRestActive ? ("rest" as const) : hasInProgressTask ? ("focus" as const) : null,
      focusMinutes: Math.floor((focusSeconds * 1000) / 60000),
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

    shouldRenderCompletionPanel,
    isCompletionPanelVisible,
    closeCompletionPanel: () => setIsCompletionPanelOpen(false),

    editingActualFocus,
    closeEditingActualFocus: () => setEditingActualFocus(null),
    handleSaveActualFocus,
    editingScheduledStart,
    closeEditingScheduledStart: () => setEditingScheduledStart(null),
    handleSaveScheduledStart,
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
