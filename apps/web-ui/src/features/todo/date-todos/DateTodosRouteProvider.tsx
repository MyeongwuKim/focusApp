import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiClock, FiTrash2 } from "react-icons/fi";
import type { TaskItem } from "../types";
import { useDailyLogMutation, useDailyLogQuery } from "../../../queries";
import { actionSheet, confirm, toast, useAppStore } from "../../../stores";

type RestDurationMin = number | null;
const REST_DURATION_DEFAULT_STORAGE_KEY = "date-tasks:rest-duration-default-min";
const REST_DURATION_ONCE_STORAGE_KEY = "date-tasks:rest-duration-once-min";

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
  restDurationDefaultMin: number | null;
};

type DailyLogWithTodos = {
  todos: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    deviationSeconds: number;
    actualFocusSeconds: number | null;
  }>;
} | null;

type DateTodosRouteContextValue = {
  items: TaskItem[];
  reorderTasksByIds: (orderedIdsValue: string[]) => void;
  handleDateTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  handleEditActualFocus: (taskId: string) => void;
  handleDateTaskMenuAction: (taskId: string) => void;

  summary: DateTodosSummary;
  session: DateTodosSession;
  toggleRestSession: () => void;
  handleApplyRestDurationOnce: (nextDurationMin: RestDurationMin) => void;
  handleSaveRestDurationDefault: (nextDurationMin: RestDurationMin) => void;

  openMemo: () => void;
  openTaskPicker: () => void;
  openRestSettings: () => void;
  openRestSettingsRequestId: number;

  isTaskPickerOpen: boolean;
  closeTaskPicker: () => void;
  handleDateAddTasks: (items: Array<{ label: string; taskId?: string | null }>) => Promise<void>;

  shouldRenderMemo: boolean;
  isMemoVisible: boolean;
  closeMemo: () => void;
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
};

const DateTodosRouteContext = createContext<DateTodosRouteContextValue | null>(null);

function readRestDurationFromSessionStorage(
  key: string,
  fallback: RestDurationMin | undefined
): RestDurationMin | undefined {
  if (typeof window === "undefined") {
    return fallback;
  }

  const rawValue = window.sessionStorage.getItem(key);
  if (rawValue === null) {
    return fallback;
  }
  if (rawValue === "null") {
    return null;
  }

  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function writeRestDurationToSessionStorage(key: string, value: RestDurationMin | undefined) {
  if (typeof window === "undefined") {
    return;
  }

  if (value === undefined) {
    window.sessionStorage.removeItem(key);
    return;
  }

  if (value === null) {
    window.sessionStorage.setItem(key, "null");
    return;
  }

  window.sessionStorage.setItem(key, String(value));
}

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function mapDailyLogTodosToTaskItems(
  dateKey: string,
  todos: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    deviationSeconds: number;
    actualFocusSeconds: number | null;
  }>
) {
  return [...todos]
    .sort((a, b) => a.order - b.order)
    .map((todo) => {
      const startedAt = toEpochMillis(todo.startedAt);
      const completedAt = toEpochMillis(todo.completedAt);
      const completedDurationMs = todo.done ? (todo.actualFocusSeconds ?? 0) * 1000 : null;
      const status: TaskItem["status"] = todo.done
        ? "done"
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
        completedAt: status === "done" ? completedAt : null,
        completedDurationMs,
      };
    });
}

export function DateTodosRouteProvider({
  dateKey,
  children,
}: {
  dateKey: string | null;
  children: ReactNode;
}) {
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);

  const [dateTasksRouteItems, setDateTasksRouteItems] = useState<TaskItem[]>([]);
  const [restDurationDefaultMin, setRestDurationDefaultMin] = useState<RestDurationMin>(
    () => readRestDurationFromSessionStorage(REST_DURATION_DEFAULT_STORAGE_KEY, null) ?? null
  );
  const [restDurationOnceMin, setRestDurationOnceMin] = useState<RestDurationMin | undefined>(() =>
    readRestDurationFromSessionStorage(REST_DURATION_ONCE_STORAGE_KEY, undefined)
  );
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const [restSettingsRequestId, setRestSettingsRequestId] = useState(0);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [shouldRenderMemo, setShouldRenderMemo] = useState(false);
  const [isMemoVisible, setIsMemoVisible] = useState(false);
  const [isCompletionPanelOpen, setIsCompletionPanelOpen] = useState(false);
  const [shouldRenderCompletionPanel, setShouldRenderCompletionPanel] = useState(false);
  const [isCompletionPanelVisible, setIsCompletionPanelVisible] = useState(false);
  const [editingActualFocus, setEditingActualFocus] = useState<{
    taskId: string;
    initialMinutes: number;
  } | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [activeRestDurationMin, setActiveRestDurationMin] = useState<RestDurationMin>(null);

  const hydratedFromApiDateKeyRef = useRef<string | null>(null);
  const wasAllDoneRef = useRef(false);
  const completionWatchReadyRef = useRef(false);

  const { dailyLogByDateQuery: dailyLogQuery } = useDailyLogQuery({ dateKey });
  const {
    addTodosMutation,
    deleteTodoMutation,
    startTodoMutation,
    pauseTodoMutation,
    resumeTodoMutation,
    completeTodoMutation,
    updateTodoActualFocusMutation,
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
    return () => {
      setSelectedDateKey(null);
    };
  }, [dateKey, setSelectedDateKey]);

  useEffect(() => {
    writeRestDurationToSessionStorage(REST_DURATION_DEFAULT_STORAGE_KEY, restDurationDefaultMin);
  }, [restDurationDefaultMin]);

  useEffect(() => {
    writeRestDurationToSessionStorage(REST_DURATION_ONCE_STORAGE_KEY, restDurationOnceMin);
  }, [restDurationOnceMin]);

  useEffect(() => {
    if (!dateKey) {
      setDateTasksRouteItems([]);
      setActiveRestDurationMin(null);
      setIsCompletionPanelOpen(false);
      wasAllDoneRef.current = false;
      completionWatchReadyRef.current = false;
      hydratedFromApiDateKeyRef.current = null;
      return;
    }

    setDateTasksRouteItems([]);
    setActiveRestDurationMin(null);
    setIsCompletionPanelOpen(false);
    wasAllDoneRef.current = false;
    completionWatchReadyRef.current = false;
    hydratedFromApiDateKeyRef.current = null;
  }, [dateKey]);

  useEffect(() => {
    if (!dateKey || !dailyLogQuery.isSuccess) {
      return;
    }

    if (hydratedFromApiDateKeyRef.current === dateKey) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    setDateTasksRouteItems(mapDailyLogTodosToTaskItems(dateKey, todos));
    hydratedFromApiDateKeyRef.current = dateKey;
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

  const nextRestDurationMin =
    restDurationOnceMin === undefined ? restDurationDefaultMin : restDurationOnceMin;
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
    if (isRestActive && activeRestDurationMin === null) {
      setActiveRestDurationMin(restDurationDefaultMin);
    }
    if (!isRestActive && activeRestDurationMin !== null) {
      setActiveRestDurationMin(null);
    }
  }, [activeRestDurationMin, isRestActive, restDurationDefaultMin]);

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

    if (isMemoOpen) {
      setShouldRenderMemo(true);
      rafId = window.requestAnimationFrame(() => {
        setIsMemoVisible(true);
      });
    } else {
      setIsMemoVisible(false);
      timeoutId = window.setTimeout(() => {
        setShouldRenderMemo(false);
      }, 240);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMemoOpen]);

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
    setDateTasksRouteItems(mapDailyLogTodosToTaskItems(dateKey, nextLog?.todos ?? []));
    hydratedFromApiDateKeyRef.current = dateKey;
  };

  const toggleRestSession = () => {
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
        } else {
          const nextLog = await startRestSessionRef.current({ dateKey });
          applyDailyLog(nextLog);
          setActiveRestDurationMin(nextRestDurationMin);
          if (restDurationOnceMin !== undefined) {
            setRestDurationOnceMin(undefined);
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "휴식 상태 업데이트 중 오류가 발생했어요.";
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
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
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

  const handleDateTaskAction = (taskId: string, action: "start" | "pause" | "resume" | "complete") => {
    if (!dateKey) {
      return;
    }

    const target = dateTasksRouteItems.find((item) => item.id === taskId);
    if (!target || target.status === "done") {
      return;
    }

    if (action === "pause") {
      void (async () => {
        try {
          const nextLog = await pauseTodoMutation.mutateAsync({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
        } catch (error) {
          const message = error instanceof Error ? error.message : "할일 상태 업데이트 중 오류가 발생했어요.";
          toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
        }
      })();
      return;
    }

    void (async () => {
      try {
        if (action === "start") {
          if (isRestActive) {
            await stopRestSessionRef.current({ dateKey });
            setActiveRestDurationMin(null);
          }
          const nextLog = await startTodoMutation.mutateAsync({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
          return;
        }

        if (action === "resume") {
          if (isRestActive) {
            await stopRestSessionRef.current({ dateKey });
            setActiveRestDurationMin(null);
          }
          const nextLog = await resumeTodoMutation.mutateAsync({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
          return;
        }

        if (action === "complete") {
          const nextLog = await completeTodoMutation.mutateAsync({ dateKey, todoId: taskId });
          applyDailyLog(nextLog);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "할일 상태 업데이트 중 오류가 발생했어요.";
        toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
      }
    })();
  };

  const handleEditActualFocus = (taskId: string) => {
    if (!dateKey) {
      return;
    }

    const target = dateTasksRouteItems.find((item) => item.id === taskId);
    if (!target || target.status !== "done") {
      return;
    }

    const initialMinutes = Math.max(Math.round((target.completedDurationMs ?? target.accumulatedMs) / 60000), 0);
    setEditingActualFocus({ taskId, initialMinutes });
  };

  const handleSaveActualFocus = async (minutes: number) => {
    if (!dateKey || !editingActualFocus) {
      return;
    }

    if (!Number.isFinite(minutes) || minutes < 0) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "0분 이상의 숫자로 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const nextLog = await updateTodoActualFocusMutation.mutateAsync({
        dateKey,
        todoId: editingActualFocus.taskId,
        actualFocusSeconds: Math.floor(minutes * 60),
      });
      applyDailyLog(nextLog);
      setEditingActualFocus(null);
      toast.show({
        type: "positive",
        title: "집중 시간 수정됨",
        message: "집중 시간이 업데이트되었습니다.",
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "집중 시간 수정 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "수정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDateAddTasks = async (items: Array<{ label: string; taskId?: string | null }>) => {
    if (!dateKey || items.length === 0) {
      return;
    }

    try {
      const nextLog = await addTodosMutation.mutateAsync({
        dateKey,
        items: items.map((item) => ({
          content: item.label,
          taskId: item.taskId ?? null,
        })),
      });
      applyDailyLog(nextLog);
    } catch (error) {
      console.error(error);
      toast.show({
        type: "error",
        title: "추가 실패",
        message: "할일을 추가하지 못했어요. 잠시 후 다시 시도해 주세요.",
        duration: 2200,
      });
    }
  };

  const handleDateTaskMenuAction = async (taskId: string) => {
    const target = dateTasksRouteItems.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    const result = await actionSheet({
      title: target.label,
      message: "작업을 선택하세요",
      items: [
        {
          label: "시작시간 설정",
          value: "schedule",
          tone: "primary",
          icon: <FiClock size={14} />,
          description: "알림 예정 시간을 설정합니다.",
        },
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 할일을 목록에서 제거합니다.",
        },
      ],
    });

    if (result === "schedule") {
      toast.show({
        type: "positive",
        title: "준비 중",
        message: "시작시간 설정 기능은 다음 단계에서 연결할게요.",
        duration: 2200,
      });
      return;
    }

    if (result === "delete") {
      if (!dateKey) {
        return;
      }

      if (target.status === "done") {
        const confirmed = await confirm({
          title: "완료한 할일을 삭제할까요?",
          message: "삭제하면 기록한 시간도 사라져요.",
          buttons: [
            { label: "취소", value: "cancel", tone: "neutral" },
            { label: "삭제", value: "delete", tone: "danger" },
          ],
        });

        if (confirmed !== "delete") {
          return;
        }
      }

      try {
        const nextLog = await deleteTodoMutation.mutateAsync({ dateKey, todoId: taskId });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "삭제됨",
          message: "할일이 삭제되었습니다.",
          duration: 1800,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "할일 삭제 중 오류가 발생했어요.";
        toast.show({ type: "error", title: "삭제 실패", message, duration: 2200 });
      }
    }
  };

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
      restDurationPreviewMin: isRestActive ? activeRestDurationMin : nextRestDurationMin,
      restDurationDefaultMin,
    };
  }, [
    activeRestDurationMin,
    dailyLogQuery.data?.restAccumulatedSeconds,
    dailyLogQuery.data?.todos,
    hasInProgressTask,
    isRestActive,
    nextRestDurationMin,
    restDurationDefaultMin,
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
    reorderTasksByIds,
    handleDateTaskAction,
    handleEditActualFocus,
    handleDateTaskMenuAction,

    summary,
    session,
    toggleRestSession,
    handleApplyRestDurationOnce: (nextDurationMin: RestDurationMin) => {
      setRestDurationOnceMin(nextDurationMin);
    },
    handleSaveRestDurationDefault: (nextDurationMin: RestDurationMin) => {
      setRestDurationDefaultMin(nextDurationMin);
      setRestDurationOnceMin(undefined);
    },

    openMemo: () => setIsMemoOpen(true),
    openTaskPicker: () => setIsTaskPickerOpen(true),
    openRestSettings: () => setRestSettingsRequestId((prev) => prev + 1),
    openRestSettingsRequestId: restSettingsRequestId,

    isTaskPickerOpen,
    closeTaskPicker: () => setIsTaskPickerOpen(false),
    handleDateAddTasks,

    shouldRenderMemo,
    isMemoVisible,
    closeMemo: () => setIsMemoOpen(false),
    resolvedMemoDateKey,

    shouldRenderCompletionPanel,
    isCompletionPanelVisible,
    closeCompletionPanel: () => setIsCompletionPanelOpen(false),

    editingActualFocus,
    closeEditingActualFocus: () => setEditingActualFocus(null),
    handleSaveActualFocus,
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
