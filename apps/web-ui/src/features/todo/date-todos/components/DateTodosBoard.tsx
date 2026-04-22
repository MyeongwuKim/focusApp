import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiClipboard, FiDownload, FiPlus } from "react-icons/fi";
import { fetchDailyLogByDate } from "../../../../api/dailyLogApi";
import { Button } from "../../../../components/ui/Button";
import { dailyLogByDateQueryKey } from "../../../../queries/daily-log/queries";
import { formatDateKey } from "../../../../utils/holidays";
import { shiftDateKey } from "../../../calendar/utils/date";
import { TodoItemCard } from "../../components/TodoItemCard";
import type { TaskItem } from "../../types";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

type DateTodosBoardProps = {
  dateKey: string;
  onShiftDate: (days: number) => void;
};

type SwipeAxis = "horizontal" | "vertical" | null;
type TouchPoint = {
  x: number;
  y: number;
};

type DailyLogPreview = {
  todos?: Array<{
    id: string;
    content: string;
    done: boolean;
    order: number;
    startedAt: string | null;
    scheduledStartAt: string | null;
    pausedAt: string | null;
    completedAt: string | null;
    actualFocusSeconds: number | null;
  }>;
} | null;

const SWIPE_AXIS_THRESHOLD = 8;
const SWIPE_DISTANCE_THRESHOLD = 56;

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function mapPreviewLogToTaskItems(dateKey: string, log: DailyLogPreview): TaskItem[] {
  const todos = log?.todos ?? [];
  const todayKey = formatDateKey(new Date());
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
        id: todo.id,
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

function isSwipeBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[role='slider']",
        "[contenteditable='true']",
        "[data-disable-date-sheet-swipe='true']",
      ].join(",")
    )
  );
}

function SortableTaskRow({
  item,
  onTaskAction,
  onEditActualFocus,
  onTaskMenuAction,
  disableActions,
  isLongPressActive,
}: {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onEditActualFocus: (taskId: string) => void;
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
        onEditActualFocus={onEditActualFocus}
        onOpenMenu={onTaskMenuAction}
        disableActions={disableActions}
        isDragging={isDragging}
        isLongPressActive={isLongPressActive}
      />
    </div>
  );
}

function PreviewTaskList({ items, isLoading }: { items: TaskItem[]; isLoading: boolean }) {
  if (isLoading && items.length === 0) {
    return (
      <div className="space-y-2">
        <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
        <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
        <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-3 px-3 py-6 text-center">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-base-200 text-base-content/60">
          <FiClipboard size={18} />
        </span>
        <p className="m-0 text-sm font-semibold text-base-content/75">등록된 할일 없음</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <TodoItemCard
          key={`preview-${item.id}`}
          item={item}
          onTaskAction={() => {
            // preview panel interactions are intentionally disabled
          }}
          onOpenMenu={() => {
            // preview panel interactions are intentionally disabled
          }}
          disableActions
        />
      ))}
    </div>
  );
}

export function DateTodosBoard({ dateKey, onShiftDate }: DateTodosBoardProps) {
  const {
    items,
    isItemsHydrating,
    reorderTasksByIds,
    handleDateTaskAction,
    handleEditActualFocus,
    handleDateTaskMenuAction,
    openRoutineImport,
    openRoutineCreate,
  } = useDateTodosRouteContext();
  const queryClient = useQueryClient();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [longPressActivatedId, setLongPressActivatedId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [pendingShiftDays, setPendingShiftDays] = useState<-1 | 0 | 1>(0);
  const [isSettling, setIsSettling] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);

  const previousDateKey = useMemo(() => shiftDateKey(dateKey, -1), [dateKey]);
  const nextDateKey = useMemo(() => shiftDateKey(dateKey, 1), [dateKey]);

  const previousQuery = useQuery({
    queryKey: dailyLogByDateQueryKey(previousDateKey),
    queryFn: () => fetchDailyLogByDate(previousDateKey),
    staleTime: 30 * 1000,
    retry: 0,
    meta: {
      skipGlobalErrorToast: true,
    },
  });

  const nextQuery = useQuery({
    queryKey: dailyLogByDateQueryKey(nextDateKey),
    queryFn: () => fetchDailyLogByDate(nextDateKey),
    staleTime: 30 * 1000,
    retry: 0,
    meta: {
      skipGlobalErrorToast: true,
    },
  });

  const previousItems = useMemo(
    () => mapPreviewLogToTaskItems(previousDateKey, previousQuery.data ?? null),
    [previousDateKey, previousQuery.data]
  );
  const nextItems = useMemo(
    () => mapPreviewLogToTaskItems(nextDateKey, nextQuery.data ?? null),
    [nextDateKey, nextQuery.data]
  );

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

  useEffect(() => {
    setOrderedIds((prev) => {
      const nextIds = items.map((item) => item.id);
      if (prev.length === 0) {
        return nextIds;
      }
      const nextSet = new Set(nextIds);
      const kept = prev.filter((id) => nextSet.has(id));
      const appended = nextIds.filter((id) => !kept.includes(id));
      return [...kept, ...appended];
    });
  }, [items]);

  useEffect(() => {
    if (!dateKey) {
      return;
    }
    void queryClient.prefetchQuery({
      queryKey: dailyLogByDateQueryKey(previousDateKey),
      queryFn: () => fetchDailyLogByDate(previousDateKey),
      staleTime: 30 * 1000,
      meta: {
        skipGlobalErrorToast: true,
      },
    });
    void queryClient.prefetchQuery({
      queryKey: dailyLogByDateQueryKey(nextDateKey),
      queryFn: () => fetchDailyLogByDate(nextDateKey),
      staleTime: 30 * 1000,
      meta: {
        skipGlobalErrorToast: true,
      },
    });
  }, [dateKey, nextDateKey, previousDateKey, queryClient]);

  const orderedItems = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const baseOrderedIds = orderedIds.length > 0 ? orderedIds : items.map((item) => item.id);
    return baseOrderedIds.map((id) => itemMap.get(id)).filter((item): item is TaskItem => Boolean(item));
  }, [items, orderedIds]);

  const clearDraggingState = () => {
    setDraggingId(null);
    setLongPressActivatedId(null);
  };

  useEffect(() => {
    setOrderedIds([]);
    clearDraggingState();
  }, [dateKey]);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearDraggingState();

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
      reorderTasksByIds(next);
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

  const handleSwipeTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (draggingId || isSettling || isSwipeBlockedTarget(event.target)) {
      touchStartRef.current = null;
      swipeAxisRef.current = null;
      return;
    }

    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeAxisRef.current = null;
    setDragX(0);
  };

  const handleSwipeTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    if (!start || isSettling) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!swipeAxisRef.current) {
      if (Math.abs(deltaX) < SWIPE_AXIS_THRESHOLD && Math.abs(deltaY) < SWIPE_AXIS_THRESHOLD) {
        return;
      }
      swipeAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (swipeAxisRef.current !== "horizontal") {
      return;
    }

    event.preventDefault();
    setDragX(deltaX);
  };

  const handleSwipeTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const axis = swipeAxisRef.current;
    const currentDragX = dragX;
    touchStartRef.current = null;
    swipeAxisRef.current = null;

    if (axis !== "horizontal") {
      setDragX(0);
      setPendingShiftDays(0);
      setSettleDirection(0);
      setIsSettling(false);
      return;
    }

    if (Math.abs(currentDragX) > SWIPE_DISTANCE_THRESHOLD) {
      const nextDirection = currentDragX < 0 ? -1 : 1;
      const nextShiftDays = currentDragX < 0 ? 1 : -1;
      setPendingShiftDays(nextShiftDays as -1 | 1);
      setSettleDirection(nextDirection);
      setIsSettling(true);
      setDragX(0);
      return;
    }

    if (Math.abs(currentDragX) <= 0.5) {
      setPendingShiftDays(0);
      setSettleDirection(0);
      setIsSettling(false);
      setDragX(0);
      return;
    }

    setPendingShiftDays(0);
    setSettleDirection(0);
    setIsSettling(true);
    setDragX(0);
  };

  return (
    <div className="min-h-0 flex-1 rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
      <div
        ref={viewportRef}
        className="min-h-0 h-full overflow-hidden touch-pan-y"
        onTouchStartCapture={handleSwipeTouchStart}
        onTouchMoveCapture={handleSwipeTouchMove}
        onTouchEndCapture={handleSwipeTouchEnd}
        onTouchCancelCapture={handleSwipeTouchEnd}
      >
        <div
          className={`flex h-full w-[300%] ${isSettling ? "transition-transform duration-220 ease-out" : ""}`}
          style={{
            transform: `translateX(calc(${-33.3333 + settleDirection * 33.3333}% + ${dragX}px))`,
          }}
          onTransitionEnd={(event) => {
            if (event.currentTarget !== event.target) {
              return;
            }
            if (!isSettling) {
              return;
            }
            if (pendingShiftDays !== 0) {
              onShiftDate(pendingShiftDays);
            }
            setPendingShiftDays(0);
            setSettleDirection(0);
            setIsSettling(false);
            setDragX(0);
          }}
        >
          <div className="min-h-0 h-full w-1/3 shrink-0 pr-1">
            <div className="no-scrollbar min-h-0 h-full overflow-y-auto pr-0.5">
              <PreviewTaskList items={previousItems} isLoading={previousQuery.isLoading} />
            </div>
          </div>

          <div className="min-h-0 h-full w-1/3 shrink-0">
            <div className="no-scrollbar min-h-0 h-full space-y-2 overflow-y-auto pr-0.5">
              {isItemsHydrating ? (
                <div className="space-y-2">
                  <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
                  <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
                  <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
                </div>
              ) : items.length === 0 ? (
                <div className="flex min-h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
                  <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
                    <FiClipboard size={20} />
                  </span>
                  <div className="space-y-1">
                    <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">
                      오늘 할 일이 비어 있어요
                    </p>
                    <p className="m-0 text-xs text-base-content/60">루틴을 불러오거나 새 루틴을 만들어 빠르게 시작해보세요.</p>
                  </div>
                  <div className="flex w-full max-w-xs gap-2" data-disable-date-sheet-swipe="true">
                    <Button variant="primary" className="flex-1 rounded-lg" onClick={openRoutineImport}>
                      <FiDownload size={13} />
                      루틴 불러오기
                    </Button>
                    <Button variant="outline" className="flex-1 rounded-lg" onClick={openRoutineCreate}>
                      <FiPlus size={13} />
                      루틴 만들기
                    </Button>
                  </div>
                </div>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragStart={(event) => setDraggingId(String(event.active.id))}
                  onDragEnd={handleDragEnd}
                  onDragCancel={clearDraggingState}
                >
                  <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-2">
                      {orderedItems.map((item) => (
                        <SortableTaskRow
                          key={item.id}
                          item={item}
                          onTaskAction={handleDateTaskAction}
                          onEditActualFocus={handleEditActualFocus}
                          onTaskMenuAction={handleDateTaskMenuAction}
                          disableActions={Boolean(draggingId)}
                          isLongPressActive={longPressActivatedId === item.id}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              )}
            </div>
          </div>

          <div className="min-h-0 h-full w-1/3 shrink-0 pl-1">
            <div className="no-scrollbar min-h-0 h-full overflow-y-auto pr-0.5">
              <PreviewTaskList items={nextItems} isLoading={nextQuery.isLoading} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
