import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  DndContext,
  MouseSensor,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiClock, FiTrash2, FiX } from "react-icons/fi";
import type { TaskItem } from "../features/todo/types";
import { actionSheet, toast, useAppStore } from "../stores";
import { dailyLogByDateQuery } from "../queries/useDailyLogByDateQuery";
import { addTodosToDailyLog } from "../api/dailyLogApi";
import { TodoItemCard } from "../features/todo/components/TodoItemCard";
import { TodoQuickActions } from "../features/todo/components/TodoQuickActions";
import { TodoProgressFooter } from "../features/todo/components/TodoProgressFooter";
import { TodoTaskPickerModal } from "../features/todo/components/TodoTaskPickerModal";
import { MemoPage } from "./MemoPage";

type SessionMode = "focus" | "rest" | null;
type RestDurationMin = number | null;

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
    completedAt: string | null;
    actualFocusSeconds: number | null;
  }>
) {
  return [...todos]
    .sort((a, b) => a.order - b.order)
    .map((todo) => {
      const startedAt = toEpochMillis(todo.startedAt);
      const completedAt = toEpochMillis(todo.completedAt);
      const completedDurationMs = todo.done ? (todo.actualFocusSeconds ?? 0) * 1000 : null;
      const status: TaskItem["status"] = todo.done ? "done" : startedAt ? "in_progress" : "todo";

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

function SortableTaskRow({
  item,
  onTaskAction,
  onTaskMenuAction,
  disableActions,
  isLongPressActive,
}: {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onTaskMenuAction: (taskId: string) => void;
  disableActions: boolean;
  isLongPressActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItemCard
        item={item}
        onTaskAction={onTaskAction}
        onOpenMenu={onTaskMenuAction}
        disableActions={disableActions}
        isDragging={isDragging}
        isLongPressActive={isLongPressActive}
      />
    </div>
  );
}

export function DateTasksRoutePage() {
  const location = useLocation();
  const dateTasksRouteDateKey = useMemo(() => {
    return new URLSearchParams(location.search).get("date");
  }, [location.search]);

  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);

  const [dateTasksRouteItems, setDateTasksRouteItems] = useState<TaskItem[]>([]);
  const [restDurationDefaultMin, setRestDurationDefaultMin] = useState<RestDurationMin>(null);
  const [restDurationOnceMin, setRestDurationOnceMin] = useState<RestDurationMin | undefined>(undefined);
  const [isTaskPickerOpen, setIsTaskPickerOpen] = useState(false);
  const [restSettingsRequestId, setRestSettingsRequestId] = useState(0);
  const [isMemoOpen, setIsMemoOpen] = useState(false);
  const [shouldRenderMemo, setShouldRenderMemo] = useState(false);
  const [isMemoVisible, setIsMemoVisible] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [longPressActivatedId, setLongPressActivatedId] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<{
    focusMs: number;
    restMs: number;
    active: SessionMode;
    startedAt: number | null;
    restDurationMin: RestDurationMin;
  }>({
    focusMs: 0,
    restMs: 0,
    active: null,
    startedAt: null,
    restDurationMin: null,
  });
  const [sessionTick, setSessionTick] = useState(0);
  const hydratedFromApiDateKeyRef = useRef<string | null>(null);
  const dailyLogQuery = dailyLogByDateQuery(dateTasksRouteDateKey);
  const addTodosMutation = useMutation({
    mutationFn: (input: { dateKey: string; items: Array<{ content: string; taskId?: string | null }> }) =>
      addTodosToDailyLog(input),
  });

  useEffect(() => {
    setSelectedDateKey(dateTasksRouteDateKey);
    return () => {
      setSelectedDateKey(null);
    };
  }, [dateTasksRouteDateKey, setSelectedDateKey]);

  useEffect(() => {
    if (!dateTasksRouteDateKey) {
      setDateTasksRouteItems([]);
      hydratedFromApiDateKeyRef.current = null;
      return;
    }

    setDateTasksRouteItems([]);
    hydratedFromApiDateKeyRef.current = null;
  }, [dateTasksRouteDateKey]);

  useEffect(() => {
    if (!dateTasksRouteDateKey || !dailyLogQuery.isSuccess) {
      return;
    }

    if (hydratedFromApiDateKeyRef.current === dateTasksRouteDateKey) {
      return;
    }

    const todos = dailyLogQuery.data?.todos ?? [];
    setDateTasksRouteItems(mapDailyLogTodosToTaskItems(dateTasksRouteDateKey, todos));
    hydratedFromApiDateKeyRef.current = dateTasksRouteDateKey;
  }, [dateTasksRouteDateKey, dailyLogQuery.data, dailyLogQuery.isSuccess]);

  useEffect(() => {
    if (!sessionState.active || !sessionState.startedAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setSessionTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionState.active, sessionState.startedAt]);

  useEffect(() => {
    setOrderedIds((prev) => {
      const nextIds = dateTasksRouteItems.map((item) => item.id);
      if (prev.length === 0) {
        return nextIds;
      }
      const nextSet = new Set(nextIds);
      const kept = prev.filter((id) => nextSet.has(id));
      const appended = nextIds.filter((id) => !kept.includes(id));
      return [...kept, ...appended];
    });
  }, [dateTasksRouteItems]);

  const orderedItems = useMemo(() => {
    const itemMap = new Map(dateTasksRouteItems.map((item) => [item.id, item]));
    return orderedIds.map((id) => itemMap.get(id)).filter((item): item is TaskItem => Boolean(item));
  }, [dateTasksRouteItems, orderedIds]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggingId(null);
    setLongPressActivatedId(null);

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) {
        return prev;
      }
      const next = arrayMove(prev, oldIndex, newIndex);
      handleDateReorderTasks(next);
      return next;
    });
  };

  useEffect(() => {
    if (!draggingId) {
      return;
    }
    setLongPressActivatedId(draggingId);
    const timer = window.setTimeout(() => {
      setLongPressActivatedId(null);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [draggingId]);

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

  const nextRestDurationMin =
    restDurationOnceMin === undefined ? restDurationDefaultMin : restDurationOnceMin;

  const startSession = (nextMode: Exclude<SessionMode, null>) => {
    const selectedRestDurationMin = nextMode === "rest" ? nextRestDurationMin : null;
    setSessionState((prev) => {
      const nowMs = Date.now();
      let nextFocusMs = prev.focusMs;
      let nextRestMs = prev.restMs;
      if (prev.active && prev.startedAt) {
        const elapsed = nowMs - prev.startedAt;
        if (prev.active === "focus") {
          nextFocusMs += elapsed;
        } else {
          nextRestMs += elapsed;
        }
      }
      return {
        focusMs: nextFocusMs,
        restMs: nextRestMs,
        active: nextMode,
        startedAt: nowMs,
        restDurationMin: selectedRestDurationMin,
      };
    });
    if (nextMode === "rest" && restDurationOnceMin !== undefined) {
      setRestDurationOnceMin(undefined);
    }
  };

  const stopSession = () => {
    setSessionState((prev) => {
      if (!prev.active || !prev.startedAt) {
        return prev;
      }
      const nowMs = Date.now();
      const elapsed = nowMs - prev.startedAt;
      return {
        focusMs: prev.active === "focus" ? prev.focusMs + elapsed : prev.focusMs,
        restMs: prev.active === "rest" ? prev.restMs + elapsed : prev.restMs,
        active: null,
        startedAt: null,
        restDurationMin: null,
      };
    });
  };

  const toggleFocusSession = () => {
    if (sessionState.active === "focus") {
      stopSession();
      return;
    }
    startSession("focus");
  };

  const toggleRestSession = () => {
    if (sessionState.active === "rest") {
      stopSession();
      return;
    }
    startSession("rest");
  };

  useEffect(() => {
    if (sessionState.active !== "rest" || !sessionState.startedAt || sessionState.restDurationMin === null) {
      return;
    }

    const restLimitMs = sessionState.restDurationMin * 60 * 1000;
    const elapsedMs = Date.now() - sessionState.startedAt;
    const remainingMs = restLimitMs - elapsedMs;

    if (remainingMs <= 0) {
      stopSession();
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
      return;
    }

    const timerId = window.setTimeout(() => {
      stopSession();
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [sessionState.active, sessionState.restDurationMin, sessionState.startedAt]);

  const handleDateTaskAction = (taskId: string, action: "start" | "pause" | "resume" | "complete") => {
    if (action === "start" || action === "resume") {
      startSession("focus");
    }
    const nowMs = Date.now();
    setDateTasksRouteItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== taskId) {
          return item;
        }
        if (item.status === "done") {
          return item;
        }
        if (action === "complete") {
          const runningMs = item.status === "in_progress" && item.startedAt ? nowMs - item.startedAt : 0;
          const completedMs = item.accumulatedMs + runningMs;
          return {
            ...item,
            status: "done",
            startedAt: null,
            accumulatedMs: completedMs,
            completedAt: nowMs,
            completedDurationMs: completedMs,
          };
        }
        if (action === "start" || action === "resume") {
          return {
            ...item,
            status: "in_progress",
            startedAt: nowMs,
          };
        }
        if (action === "pause") {
          const runningMs = item.status === "in_progress" && item.startedAt ? nowMs - item.startedAt : 0;
          return {
            ...item,
            status: "paused",
            startedAt: null,
            accumulatedMs: item.accumulatedMs + runningMs,
          };
        }
        return item;
      })
    );
  };

  const handleDateReorderTasks = (orderedIds: string[]) => {
    setDateTasksRouteItems((prevItems) => {
      const itemMap = new Map(prevItems.map((item) => [item.id, item]));
      const reordered = orderedIds
        .map((id) => itemMap.get(id))
        .filter((item): item is TaskItem => Boolean(item));
      const remaining = prevItems.filter((item) => !orderedIds.includes(item.id));
      return [...reordered, ...remaining];
    });
  };

  const handleDateAddTasks = async (
    items: Array<{
      label: string;
      taskId?: string | null;
    }>
  ) => {
    if (!dateTasksRouteDateKey || items.length === 0) {
      return;
    }

    try {
      const nextLog = await addTodosMutation.mutateAsync({
        dateKey: dateTasksRouteDateKey,
        items: items.map((item) => ({
          content: item.label,
          taskId: item.taskId ?? null,
        })),
      });
      setDateTasksRouteItems(mapDailyLogTodosToTaskItems(dateTasksRouteDateKey, nextLog.todos ?? []));
      hydratedFromApiDateKeyRef.current = dateTasksRouteDateKey;
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
      setDateTasksRouteItems((prevItems) => prevItems.filter((item) => item.id !== taskId));
      toast.show({
        type: "positive",
        title: "삭제됨",
        message: "할일이 삭제되었습니다.",
        duration: 1800,
      });
    }
  };

  const dateTasksSummary = useMemo(() => {
    const totalCount = dateTasksRouteItems.length;
    const completedItems = dateTasksRouteItems.filter((item) => item.status === "done");
    const completedCount = completedItems.length;
    const completedMs = completedItems.reduce(
      (acc, item) => acc + (item.completedDurationMs ?? item.accumulatedMs),
      0
    );
    const totalMinutes = Math.round(completedMs / 60000);
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return {
      totalCount,
      completedCount,
      totalMinutes,
      progressPercent,
    };
  }, [dateTasksRouteItems]);

  const sessionSummary = useMemo(() => {
    const nowMs = Date.now();
    const activeElapsed = sessionState.active && sessionState.startedAt ? nowMs - sessionState.startedAt : 0;
    const focusMs = sessionState.focusMs + (sessionState.active === "focus" ? activeElapsed : 0);
    const restMs = sessionState.restMs + (sessionState.active === "rest" ? activeElapsed : 0);
    return {
      active: sessionState.active,
      focusMinutes: Math.floor(focusMs / 60000),
      restMinutes: Math.floor(restMs / 60000),
      restDurationPreviewMin:
        sessionState.active === "rest" ? sessionState.restDurationMin : nextRestDurationMin,
      restDurationDefaultMin,
    };
  }, [nextRestDurationMin, restDurationDefaultMin, sessionState, sessionTick]);

  const handleApplyRestDurationOnce = (nextDurationMin: RestDurationMin) => {
    setRestDurationOnceMin(nextDurationMin);
  };

  const handleSaveRestDurationDefault = (nextDurationMin: RestDurationMin) => {
    setRestDurationDefaultMin(nextDurationMin);
    setRestDurationOnceMin(undefined);
  };

  const resolvedMemoDateKey = useMemo(() => {
    if (dateTasksRouteDateKey) {
      return dateTasksRouteDateKey;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
      now.getDate()
    ).padStart(2, "0")}`;
  }, [dateTasksRouteDateKey]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <div className="min-h-0 flex-1 rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
        <div className="no-scrollbar min-h-0 h-full space-y-2 overflow-y-auto pr-0.5">
          {orderedItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => setDraggingId(String(event.active.id))}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setDraggingId(null);
                setLongPressActivatedId(null);
              }}
            >
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedItems.map((item) => (
                    <SortableTaskRow
                      key={item.id}
                      item={item}
                      onTaskAction={handleDateTaskAction}
                      onTaskMenuAction={handleDateTaskMenuAction}
                      disableActions={Boolean(draggingId)}
                      isLongPressActive={longPressActivatedId === item.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="m-0 px-1 py-2 text-sm text-base-content/70">이 날짜에는 할 일이 없어요.</p>
          )}
        </div>
      </div>

      <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
        <TodoQuickActions
          onOpenMemo={() => setIsMemoOpen(true)}
          onOpenTaskPicker={() => setIsTaskPickerOpen(true)}
          onOpenRestSettings={() => setRestSettingsRequestId((prev) => prev + 1)}
        />
        <TodoProgressFooter
          summary={dateTasksSummary}
          session={sessionSummary}
          onToggleFocus={toggleFocusSession}
          onToggleRest={toggleRestSession}
          onApplyRestDurationOnce={handleApplyRestDurationOnce}
          onSaveRestDurationDefault={handleSaveRestDurationDefault}
          openRestSettingsRequestId={restSettingsRequestId}
        />
      </div>

      <TodoTaskPickerModal
        isOpen={isTaskPickerOpen}
        onClose={() => setIsTaskPickerOpen(false)}
        onApply={handleDateAddTasks}
      />

      {shouldRenderMemo ? (
        <div
          className={[
            "absolute inset-0 z-40 transition-opacity duration-250 ease-out",
            isMemoVisible ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-0 flex flex-col bg-base-100 transition-[transform,opacity] duration-250 ease-out",
              isMemoVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90",
            ].join(" ")}
          >
            <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-base-300/80 px-2">
              <button
                type="button"
                aria-label="메모 닫기"
                className="btn btn-sm btn-ghost btn-circle"
                onClick={() => setIsMemoOpen(false)}
              >
                <FiX size={18} />
              </button>
              <h2 className="m-0 text-center text-sm font-semibold text-base-content">
                {resolvedMemoDateKey} 메모
              </h2>
              <div aria-hidden="true" />
            </header>
            <div className="min-h-0 flex-1 p-2">
              <MemoPage
                dateKey={resolvedMemoDateKey}
                className="h-full rounded-xl border-base-300/70 bg-base-200/35 p-2.5"
              />
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
