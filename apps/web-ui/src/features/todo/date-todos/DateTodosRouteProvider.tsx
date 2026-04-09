import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FiCheckCircle, FiClock, FiRotateCcw, FiTrash2 } from "react-icons/fi";
import type { TaskItem } from "../types";
import type { RoutineTemplate } from "../../../api/routineTemplateApi";
import { useDailyLogMutation, useDailyLogQuery, useRoutineTemplateMutation, useRoutineTemplateQuery } from "../../../queries";
import { actionSheet, confirm, toast, useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";

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
  toggleRestSession: () => void;
  handleApplyRestDurationOnce: (nextDurationMin: RestDurationMin) => void;
  handleSaveRestDurationDefault: (nextDurationMin: RestDurationMin) => void;

  openMemo: () => void;
  openTaskPicker: () => void;
  openRestSettings: () => void;
  openRestSettingsRequestId: number;

  isTaskPickerOpen: boolean;
  closeTaskPicker: () => void;
  handleDateAddTasks: (items: Array<{ label: string; taskId?: string | null; scheduledStartAt?: string | null }>) => Promise<void>;
  openRoutineImport: () => void;
  openRoutineCreate: () => void;
  isRoutineImportOpen: boolean;
  closeRoutineImport: () => void;
  isRoutineCreateOpen: boolean;
  closeRoutineCreate: () => void;
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
  editingScheduledStart: {
    taskId: string;
    initialTime: string;
  } | null;
  closeEditingScheduledStart: () => void;
  handleSaveScheduledStart: (time: string) => Promise<void>;
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

function toIsoByDateAndHHmm(dateKey: string, hhmm?: string | null) {
  if (!hhmm) {
    return null;
  }
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm.trim());
  if (!match) {
    return null;
  }
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = hhmm.split(":").map(Number);
  const date = new Date(year, month - 1, day, hour, minute, 0, 0);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
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
  const [isRoutineImportOpen, setIsRoutineImportOpen] = useState(false);
  const [isRoutineCreateOpen, setIsRoutineCreateOpen] = useState(false);
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
  const [editingScheduledStart, setEditingScheduledStart] = useState<{
    taskId: string;
    initialTime: string;
  } | null>(null);
  const [liveTick, setLiveTick] = useState(0);
  const [activeRestDurationMin, setActiveRestDurationMin] = useState<RestDurationMin>(null);
  const [hydratedDateKey, setHydratedDateKey] = useState<string | null>(null);

  const wasAllDoneRef = useRef(false);
  const completionWatchReadyRef = useRef(false);

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
      setHydratedDateKey(null);
      return;
    }

    setDateTasksRouteItems([]);
    setActiveRestDurationMin(null);
    setIsCompletionPanelOpen(false);
    wasAllDoneRef.current = false;
    completionWatchReadyRef.current = false;
    setHydratedDateKey(null);
  }, [dateKey]);

  useEffect(() => {
    if (!dateKey || !dailyLogQuery.isSuccess) {
      return;
    }

    if (hydratedDateKey === dateKey) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    setDateTasksRouteItems(mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), todos));
    setHydratedDateKey(dateKey);
  }, [dateKey, dailyLogQuery.data, dailyLogQuery.isSuccess, hydratedDateKey]);

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
    setDateTasksRouteItems(
      mapDailyLogTodosToTaskItems(dateKey, formatDateKey(new Date()), nextLog?.todos ?? [])
    );
    setHydratedDateKey(dateKey);
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
    if (!target) {
      return;
    }

    if (target.status === "done" && action !== "start") {
      return;
    }

    if (action === "start" || action === "resume") {
      const hasAnotherInProgress = dateTasksRouteItems.some(
        (item) => item.id !== taskId && item.status === "in_progress"
      );
      if (hasAnotherInProgress) {
        toast.show({
          type: "error",
          title: "동시 진행 불가",
          message: "진행 중인 할일이 있어요.",
          duration: 2000,
        });
        return;
      }
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
          const todayKey = formatDateKey(new Date());
          if (dateKey !== todayKey) {
            const confirmed = await confirm({
              title: "오늘 날짜가 아니에요",
              message: "선택한 날짜의 할일을 시작할까요?",
              buttons: [
                { label: "취소", value: "cancel", tone: "neutral" },
                { label: "시작", value: "start", tone: "primary" },
              ],
            });

            if (confirmed !== "start") {
              return;
            }
          }

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

  const handleSaveScheduledStart = async (time: string) => {
    if (!dateKey || !editingScheduledStart) {
      return;
    }

    const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
    if (!timeMatch) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "시간은 HH:mm 형식으로 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    const [hour, minute] = time.split(":").map(Number);
    const [year, month, day] = dateKey.split("-").map(Number);
    const scheduled = new Date(year, month - 1, day, hour, minute, 0, 0);
    if (Number.isNaN(scheduled.getTime())) {
      toast.show({
        type: "error",
        title: "시간 형식 오류",
        message: "시작 시간을 확인해 주세요.",
        duration: 2200,
      });
      return;
    }

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
    if (dateKey === todayKey && scheduled.getTime() <= now.getTime()) {
      toast.show({
        type: "error",
        title: "시간 선택 오류",
        message: "오늘 일정은 현재 시각 이후로 설정해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const nextLog = await updateTodoScheduleMutation.mutateAsync({
        dateKey,
        todoId: editingScheduledStart.taskId,
        scheduledStartAt: scheduled.toISOString(),
      });
      applyDailyLog(nextLog);
      setEditingScheduledStart(null);
      toast.show({
        type: "positive",
        title: "시작시간 설정됨",
        message: `${time}에 알림 기준 시간으로 저장했어요.`,
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "시작시간 저장 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "설정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDateAddTasks = async (
    items: Array<{ label: string; taskId?: string | null; scheduledStartAt?: string | null }>
  ) => {
    if (!dateKey || items.length === 0) {
      return;
    }

    try {
      const nextLog = await addTodosMutation.mutateAsync({
        dateKey,
        items: items.map((item) => ({
          content: item.label,
          taskId: item.taskId ?? null,
          scheduledStartAt: item.scheduledStartAt ?? null,
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

  const handleApplyRoutineTemplate = async (routineTemplateId: string) => {
    if (!dateKey) {
      return;
    }

    const routine = (routineTemplatesQuery.data ?? []).find(
      (template) => template.id === routineTemplateId
    );
    if (!routine) {
      toast.show({
        type: "error",
        title: "루틴 없음",
        message: "선택한 루틴을 찾을 수 없어요.",
        duration: 2200,
      });
      return;
    }

    await handleDateAddTasks(
      routine.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((item) => ({
          label: item.content,
          taskId: item.taskId ?? null,
          scheduledStartAt: toIsoByDateAndHHmm(dateKey, item.scheduledTimeHHmm),
        }))
    );
  };

  const handleCreateRoutineTemplate = async (input: {
    name: string;
    items: Array<{
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => {
    const normalizedName = input.name.trim();
    if (!normalizedName) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "루틴 이름을 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    const duplicatedName = (routineTemplatesQuery.data ?? []).some(
      (template) => template.name.trim().toLowerCase() === normalizedName.toLowerCase()
    );
    if (duplicatedName) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "같은 이름의 루틴이 이미 있어요.",
        duration: 2200,
      });
      return;
    }

    const normalizedItems = input.items
      .map((item) => ({
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content.trim(),
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      }))
      .filter((item) => item.content.length > 0);

    if (normalizedItems.length === 0) {
      toast.show({
        type: "error",
        title: "저장 실패",
        message: "루틴 항목을 1개 이상 입력해 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      const created = await createRoutineTemplateMutation.mutateAsync({
        name: normalizedName,
        items: normalizedItems.map((item, index) => ({
          taskId: item.taskId,
          titleSnapshot: item.titleSnapshot,
          content: item.content,
          order: index,
          scheduledTimeHHmm: item.scheduledTimeHHmm,
        })),
      });
      toast.show({
        type: "positive",
        title: "루틴 저장됨",
        message: `${created.name} 루틴을 저장했어요.`,
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 저장 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 저장 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleUpdateRoutineTemplate = async (input: {
    routineTemplateId: string;
    items: Array<{
      id?: string;
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => {
    const normalizedItems = input.items
      .map((item) => ({
        id: item.id,
        taskId: item.taskId ?? null,
        titleSnapshot: item.titleSnapshot ?? null,
        content: item.content.trim(),
        scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
      }))
      .filter((item) => item.content.length > 0);

    if (normalizedItems.length === 0) {
      toast.show({
        type: "error",
        title: "수정 실패",
        message: "루틴 항목을 1개 이상 남겨 주세요.",
        duration: 2200,
      });
      return;
    }

    try {
      await updateRoutineTemplateMutation.mutateAsync({
        routineTemplateId: input.routineTemplateId,
        items: normalizedItems.map((item, index) => ({
          id: item.id,
          taskId: item.taskId,
          titleSnapshot: item.titleSnapshot,
          content: item.content,
          order: index,
          scheduledTimeHHmm: item.scheduledTimeHHmm,
        })),
      });
      toast.show({
        type: "positive",
        title: "루틴 수정됨",
        message: "루틴 항목이 업데이트되었어요.",
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 수정 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 수정 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDeleteRoutineTemplate = async (routineTemplateId: string) => {
    try {
      await deleteRoutineTemplateMutation.mutateAsync({ routineTemplateId });
      toast.show({
        type: "positive",
        title: "루틴 삭제됨",
        message: "저장된 루틴을 삭제했어요.",
        duration: 1800,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "루틴 삭제 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "루틴 삭제 실패",
        message,
        duration: 2200,
      });
    }
  };

  const handleDateTaskMenuAction = async (taskId: string) => {
    const target = dateTasksRouteItems.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    const canCompleteFromMenu = target.status === "overdue";
    const canReset = target.status === "in_progress" || target.status === "paused" || target.status === "done";
    const resetLabel = "초기화";
    const resetDescription =
      target.status === "done" ? "시작 전 상태로 되돌립니다." : "진행 기록을 초기화하고 시작 전 상태로 되돌립니다.";

    const result = await actionSheet({
      title: target.label,
      message: "작업을 선택하세요",
      items: [
        ...(canCompleteFromMenu
          ? [
              {
                label: "완료 처리",
                value: "mark_done",
                tone: "primary" as const,
                icon: <FiCheckCircle size={14} />,
                description: "완료 상태로 변경합니다.",
              },
            ]
          : []),
        ...(canReset
          ? [
              {
                label: resetLabel,
                value: "mark_todo",
                tone: "muted" as const,
                icon: <FiRotateCcw size={14} />,
                description: resetDescription,
              },
            ]
          : []),
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

    if (result === "mark_done") {
      handleDateTaskAction(taskId, "complete");
      return;
    }

    if (result === "mark_todo") {
      if (!dateKey) {
        return;
      }

      try {
        const nextLog = await resetTodoMutation.mutateAsync({ dateKey, todoId: taskId });
        applyDailyLog(nextLog);
        toast.show({
          type: "positive",
          title: "초기화됨",
          message: "할일이 시작 전 상태로 되돌아갔어요.",
          duration: 1800,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : "할일 상태 업데이트 중 오류가 발생했어요.";
        toast.show({ type: "error", title: "업데이트 실패", message, duration: 2200 });
      }
      return;
    }

    if (result === "schedule") {
      if (target.status === "done" || target.status === "overdue") {
        toast.show({
          type: "error",
          title: "설정 불가",
          message: "완료/미완료 상태에서는 시작시간을 설정할 수 없어요.",
          duration: 2200,
        });
        return;
      }

      const initialDate = target.scheduledStartAt ? new Date(target.scheduledStartAt) : new Date();
      const initialTime = `${String(initialDate.getHours()).padStart(2, "0")}:${String(
        initialDate.getMinutes()
      ).padStart(2, "0")}`;
      setEditingScheduledStart({ taskId, initialTime });
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
    isItemsHydrating,
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
    openRoutineImport: () => setIsRoutineImportOpen(true),
    openRoutineCreate: () => setIsRoutineCreateOpen(true),
    isRoutineImportOpen,
    closeRoutineImport: () => setIsRoutineImportOpen(false),
    isRoutineCreateOpen,
    closeRoutineCreate: () => setIsRoutineCreateOpen(false),
    routineTemplates: routineTemplatesQuery.data ?? [],
    isRoutineTemplatesLoading: routineTemplatesQuery.isLoading,
    handleApplyRoutineTemplate,
    handleCreateRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,

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
