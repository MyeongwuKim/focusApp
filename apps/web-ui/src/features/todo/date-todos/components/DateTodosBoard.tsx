import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { FiClipboard, FiRotateCcw } from "react-icons/fi";
import { fetchDailyLogByDate } from "../../../../api/dailyLogApi";
import { useHorizontalSwipeGesture } from "../../../../hooks/useHorizontalSwipeGesture";
import { useSortableItem } from "../../../../hooks/useSortableItem";
import { useSortableSensors } from "../../../../hooks/useSortableSensors";
import { useRoutineTemplateWeekdayAssignmentsQuery } from "../../../../queries";
import { dailyLogByDateQueryKey } from "../../../../queries/daily-log/queries";
import { confirm } from "../../../../stores";
import { reorderStringIdsByDrag } from "../../../../utils/dnd";
import { formatDateKey } from "../../../../utils/holidays";
import { shiftDateKey } from "../../../calendar/utils/date";
import { TodoItemCard } from "../../components/TodoItemCard";
import { InlineTodoHandwritingComposer } from "../../components/InlineTodoHandwritingComposer";
import type { TaskItem } from "../../types";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";
import { useRepeatTaskSuggestionPrompt } from "../hooks/useRepeatTaskSuggestionPrompt";
import { mapDailyLogPreviewToTaskItems } from "../utils/dateTodosPreview";
import {
  resolvePageTurnDurationMs,
  shouldCompletePageTurn,
} from "../utils/pageTurnMotion";
import { DateTodosEmptyState } from "./DateTodosEmptyState";
import { RestCoffeeScene } from "./RestCoffeeScene";
import type { WeekdayRoutinePreviewItem } from "./WeekdayRoutinePreviewCard";

type DateTodosBoardProps = {
  dateKey: string;
  onShiftDate: (days: number) => void;
  enableDateSwipe?: boolean;
  /** 되돌리기 대기 중인 삭제 항목 ID를 전달해 하단 진행률을 즉시 갱신한다. */
  onPendingGestureDeletionChange?: (taskId: string | null) => void;
};

type PendingWriteAnimation = {
  existingIds: Set<string>;
  label: string;
};

const PAGE_TURN_FALLBACK_BUFFER_MS = 180;
const DAY_IN_MS = 24 * 60 * 60 * 1000;
const GESTURE_DELETE_UNDO_DELAY_MS = 4000;

function parseDateKeyToLocalDate(dateKey: string) {
  const [yearRaw, monthRaw, dayRaw] = dateKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
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
  onTaskMenuAction,
  onDeleteGesture,
  disableActions,
  canRunFocus,
  isLongPressActive,
  isWriteAnimating,
  onWriteAnimationStarted,
}: {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onTaskMenuAction: (taskId: string) => void;
  onDeleteGesture: (taskId: string) => void;
  disableActions: boolean;
  canRunFocus: boolean;
  isLongPressActive: boolean;
  isWriteAnimating: boolean;
  onWriteAnimationStarted: (taskId: string) => void;
}) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableItem({
    id: item.id,
  });

  return (
    <div ref={setNodeRef} style={style} {...dragHandleProps}>
      <TodoItemCard
        item={item}
        onTaskAction={onTaskAction}
        onOpenMenu={onTaskMenuAction}
        onDeleteGesture={onDeleteGesture}
        disableActions={disableActions}
        canRunFocus={canRunFocus}
        isDragging={isDragging}
        isLongPressActive={isLongPressActive}
        isWriteAnimating={isWriteAnimating}
        onWriteAnimationStarted={onWriteAnimationStarted}
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
    <div className="todo-item-list space-y-2">
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
          canRunFocus={false}
        />
      ))}
    </div>
  );
}

export function DateTodosBoard({
  dateKey,
  onShiftDate,
  enableDateSwipe = true,
  onPendingGestureDeletionChange,
}: DateTodosBoardProps) {
  const {
    items,
    isItemsHydrating,
    reorderTasksByIds,
    handleDateTaskAction,
    handleDateTaskMenuAction,
    handleDateTaskGestureDelete,
    handleDateAddTasks,
    openRoutineImport,
    routineTemplates,
    isRoutineTemplatesLoading,
    handleApplyRoutineTemplate,
    session,
  } = useDateTodosRouteContext();
  const { routineTemplateWeekdayAssignmentsQuery } = useRoutineTemplateWeekdayAssignmentsQuery();
  const { promptTaskSuggestion } = useRepeatTaskSuggestionPrompt();
  const queryClient = useQueryClient();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [longPressActivatedId, setLongPressActivatedId] = useState<string | null>(null);
  const [dragX, setDragX] = useState(0);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [pendingShiftDays, setPendingShiftDays] = useState<-1 | 0 | 1>(0);
  const [isSettling, setIsSettling] = useState(false);
  const [settleDurationMs, setSettleDurationMs] = useState(420);
  const [isApplyingWeekdayRoutine, setIsApplyingWeekdayRoutine] = useState(false);
  const [isApplyingCarryOver, setIsApplyingCarryOver] = useState(false);
  const [isApplyingRoutineAndCarryOver, setIsApplyingRoutineAndCarryOver] = useState(false);
  const [pendingGestureDeletion, setPendingGestureDeletion] = useState<TaskItem | null>(null);
  const [pendingWriteAnimation, setPendingWriteAnimation] = useState<PendingWriteAnimation | null>(null);
  const [viewportWidth, setViewportWidth] = useState(1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const contentScrollRef = useRef<HTMLDivElement | null>(null);
  const gestureDeleteTimerRef = useRef<number | null>(null);
  /** 삭제를 요청한 날짜의 처리 함수를 보관해, 날짜가 바뀐 뒤에도 원래 항목을 확정 삭제한다. */
  const pendingGestureDeleteCommitRef = useRef<(() => void) | null>(null);
  /** 빠르게 여러 항목을 지워도 서버 응답이 역순으로 반영되지 않도록 삭제 요청을 순서대로 연결한다. */
  const gestureDeleteCommitChainRef = useRef<Promise<void>>(Promise.resolve());
  const hasCompletedPageTurnRef = useRef(false);
  const todayDateKey = formatDateKey(new Date());
  const isPastDate = dateKey < todayDateKey;
  const isFutureDate = dateKey > todayDateKey;
  const daysToToday = useMemo(() => {
    const selectedDate = parseDateKeyToLocalDate(dateKey);
    const todayDate = parseDateKeyToLocalDate(todayDateKey);
    if (!selectedDate || !todayDate) {
      return 0;
    }
    return Math.round((todayDate.getTime() - selectedDate.getTime()) / DAY_IN_MS);
  }, [dateKey, todayDateKey]);
  const selectedDateWeekday = useMemo(() => {
    const localDate = parseDateKeyToLocalDate(dateKey);
    return localDate ? localDate.getDay() : null;
  }, [dateKey]);
  const assignedWeekdayRoutineTemplate = useMemo(() => {
    if (selectedDateWeekday === null) {
      return null;
    }
    const assignment = (routineTemplateWeekdayAssignmentsQuery.data ?? []).find(
      (item) => item.weekday === selectedDateWeekday && item.routineTemplateId
    );
    if (!assignment?.routineTemplateId) {
      return null;
    }
    return (
      routineTemplates.find((template) => template.id === assignment.routineTemplateId) ??
      assignment.routineTemplate ??
      null
    );
  }, [routineTemplateWeekdayAssignmentsQuery.data, routineTemplates, selectedDateWeekday]);
  const weekdayRoutinePreviewItems: WeekdayRoutinePreviewItem[] = useMemo(
    () =>
      (assignedWeekdayRoutineTemplate?.items ?? [])
        .slice()
        .sort((a, b) => a.order - b.order)
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          content: item.content,
        })),
    [assignedWeekdayRoutineTemplate]
  );
  const {
    handleTouchStart: handleBoardSwipeTouchStart,
    handleTouchMove: handleBoardSwipeTouchMove,
    handleTouchEnd: handleBoardSwipeTouchEnd,
    handleTouchCancel: handleBoardSwipeTouchCancel,
  } = useHorizontalSwipeGesture({
    canStart: (event) => enableDateSwipe && !(draggingId || isSettling || isSwipeBlockedTarget(event.target)),
    onStart: () => {
      hasCompletedPageTurnRef.current = false;
      setViewportWidth(viewportRef.current?.clientWidth ?? 1);
      setDragX(0);
    },
    onHorizontalMove: ({ deltaX }) => {
      setDragX(deltaX);
    },
    onEnd: ({ axis, deltaX, velocityX }) => {
      if (axis !== "horizontal") {
        setDragX(0);
        setPendingShiftDays(0);
        setSettleDirection(0);
        setIsSettling(false);
        return;
      }

      setSettleDurationMs(resolvePageTurnDurationMs(velocityX));

      if (shouldCompletePageTurn(deltaX, velocityX)) {
        const nextDirection = deltaX < 0 ? -1 : 1;
        const nextShiftDays = deltaX < 0 ? 1 : -1;
        setPendingShiftDays(nextShiftDays as -1 | 1);
        setSettleDirection(nextDirection);
        setIsSettling(true);
        setDragX(0);
        return;
      }

      if (Math.abs(deltaX) <= 0.5) {
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
    },
    onCancel: () => {
      setDragX(0);
      setPendingShiftDays(0);
      setSettleDirection(0);
      setIsSettling(false);
    },
  });

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
    () => mapDailyLogPreviewToTaskItems(previousDateKey, previousQuery.data ?? null),
    [previousDateKey, previousQuery.data]
  );
  const yesterdayIncompleteItems = useMemo(
    () =>
      (previousQuery.data?.todos ?? [])
        .filter((todo) => !todo.done)
        .map((todo) => ({
          label: todo.content,
          taskId: todo.taskId ?? null,
        })),
    [previousQuery.data?.todos]
  );
  const yesterdayIncompleteCount = yesterdayIncompleteItems.length;
  const nextItems = useMemo(
    () => mapDailyLogPreviewToTaskItems(nextDateKey, nextQuery.data ?? null),
    [nextDateKey, nextQuery.data]
  );

  const sensors = useSortableSensors();

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
  const visibleOrderedItems = useMemo(
    () => orderedItems.filter((item) => item.id !== pendingGestureDeletion?.id),
    [orderedItems, pendingGestureDeletion?.id]
  );

  useEffect(() => {
    onPendingGestureDeletionChange?.(pendingGestureDeletion?.id ?? null);
  }, [onPendingGestureDeletionChange, pendingGestureDeletion?.id]);

  useEffect(() => {
    return () => onPendingGestureDeletionChange?.(null);
  }, [onPendingGestureDeletionChange]);

  const sortableIds = useMemo(() => visibleOrderedItems.map((item) => item.id), [visibleOrderedItems]);
  const writeAnimatingTaskId = pendingWriteAnimation
    ? items.find(
        (item) =>
          !pendingWriteAnimation.existingIds.has(item.id) &&
          item.label.trim() === pendingWriteAnimation.label.trim()
      )?.id ?? items.find((item) => !pendingWriteAnimation.existingIds.has(item.id))?.id ?? null
    : null;

  const clearGestureDeleteTimer = useCallback(() => {
    if (gestureDeleteTimerRef.current !== null) {
      window.clearTimeout(gestureDeleteTimerRef.current);
      gestureDeleteTimerRef.current = null;
    }
  }, []);

  const undoGestureDelete = useCallback(() => {
    clearGestureDeleteTimer();
    pendingGestureDeleteCommitRef.current = null;
    setPendingGestureDeletion(null);
  }, [clearGestureDeleteTimer]);

  /** 되돌리기 대기 중인 삭제를 즉시 실행한다. 날짜 이동·화면 이탈 전에 호출하면 원래 날짜의 항목을 삭제한다. */
  const commitPendingGestureDelete = useCallback(() => {
    clearGestureDeleteTimer();
    const commit = pendingGestureDeleteCommitRef.current;
    pendingGestureDeleteCommitRef.current = null;
    setPendingGestureDeletion(null);
    commit?.();
  }, [clearGestureDeleteTimer]);

  /**
   * 종이 전환을 한 번만 마무리하고 확정된 경우에만 날짜를 이동한다.
   * transitionend와 안전 타이머가 동시에 실행돼도 중복 이동하지 않는다.
   */
  const completePageTurn = useCallback(() => {
    if (hasCompletedPageTurnRef.current || !isSettling) {
      return;
    }
    hasCompletedPageTurnRef.current = true;

    if (pendingShiftDays !== 0) {
      commitPendingGestureDelete();
      onShiftDate(pendingShiftDays);
    }
    setPendingShiftDays(0);
    setSettleDirection(0);
    setIsSettling(false);
    setDragX(0);
  }, [commitPendingGestureDelete, isSettling, onShiftDate, pendingShiftDays]);

  /** WebView가 transform 종료 이벤트를 전달하지 않아도 페이지가 중간에서 멈추지 않게 전환을 강제로 마무리한다. */
  useEffect(() => {
    if (!isSettling) {
      return;
    }
    const timer = window.setTimeout(
      completePageTurn,
      settleDurationMs + PAGE_TURN_FALLBACK_BUFFER_MS
    );
    return () => window.clearTimeout(timer);
  }, [completePageTurn, isSettling, settleDurationMs]);

  /**
   * 선 긋기로 삭제할 항목을 화면에서 먼저 숨기고 4초 동안 되돌릴 수 있게 대기시킨다.
   * 완료 항목은 집중 기록도 함께 사라지므로 확인을 받은 뒤에만 삭제 대기 상태로 전환한다.
   */
  const queueGestureDelete = async (taskId: string) => {
    const target = items.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    if (target.status === "done") {
      const selected = await confirm({
        title: "완료한 할 일을 지울까요?",
        message: "삭제하면 완료 상태와 집중 기록도 함께 사라져요.",
        buttons: [
          { label: "그대로 두기", value: "cancel", tone: "neutral" },
          { label: "삭제", value: "delete", tone: "danger" },
        ],
      });
      if (selected !== "delete") {
        return;
      }
    }

    if (pendingGestureDeletion) {
      commitPendingGestureDelete();
    }

    setPendingGestureDeletion(target);
    const commitDeletion = () => {
      gestureDeleteCommitChainRef.current = gestureDeleteCommitChainRef.current
        .catch(() => undefined)
        .then(async () => {
          await handleDateTaskGestureDelete(taskId);
        });
    };
    pendingGestureDeleteCommitRef.current = commitDeletion;
    clearGestureDeleteTimer();
    gestureDeleteTimerRef.current = window.setTimeout(() => {
      gestureDeleteTimerRef.current = null;
      pendingGestureDeleteCommitRef.current = null;
      setPendingGestureDeletion((current) => (current?.id === taskId ? null : current));
      commitDeletion();
    }, GESTURE_DELETE_UNDO_DELAY_MS);
  };

  useEffect(() => {
    return () => {
      clearGestureDeleteTimer();
      const commit = pendingGestureDeleteCommitRef.current;
      pendingGestureDeleteCommitRef.current = null;
      commit?.();
    };
  }, [clearGestureDeleteTimer]);

  /** 새 카드가 글씨 쓰기 효과를 시작하면 추가 요청의 대기 상태를 즉시 소비해 재조회 시 재생되는 일을 막는다. */
  const consumeWriteAnimation = useCallback((taskId: string) => {
    setPendingWriteAnimation((current) => {
      if (!current || current.existingIds.has(taskId)) {
        return current;
      }
      return null;
    });
  }, []);

  const clearDraggingState = () => {
    setDraggingId(null);
    setLongPressActivatedId(null);
  };

  useEffect(() => {
    setOrderedIds([]);
    clearDraggingState();
    commitPendingGestureDelete();
  }, [commitPendingGestureDelete, dateKey]);

  const pageTurnProgress = isSettling && settleDirection !== 0
    ? 1
    : Math.min(Math.abs(dragX) / Math.max(viewportWidth * 0.82, 1), 1);
  const pageTurnDirection = settleDirection < 0 || (settleDirection === 0 && dragX < 0)
    ? "next"
    : settleDirection > 0 || dragX > 0
      ? "previous"
      : "idle";
  const pageRotation = pageTurnDirection === "next"
    ? -pageTurnProgress * 98
    : pageTurnDirection === "previous"
      ? pageTurnProgress * 98
      : 0;
  const pageTurnStyle = {
    transform: `rotateY(${pageRotation}deg)`,
    transformOrigin: pageTurnDirection === "next" ? "left center" : "right center",
  } as CSSProperties;
  const pageTurnViewportStyle = {
    "--page-turn-progress": pageTurnProgress,
    "--page-turn-duration": `${settleDurationMs}ms`,
  } as CSSProperties;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearDraggingState();

    if (!over || active.id === over.id) {
      return;
    }

    const next = reorderStringIdsByDrag(sortableIds, String(active.id), String(over.id));
    if (next === sortableIds) {
      return;
    }

    setOrderedIds(next);
    reorderTasksByIds(next);
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

  const handleApplyWeekdayRoutine = () => {
    if (!assignedWeekdayRoutineTemplate?.id) {
      return;
    }
    setIsApplyingWeekdayRoutine(true);
    void handleApplyRoutineTemplate(assignedWeekdayRoutineTemplate.id).finally(() => {
      setIsApplyingWeekdayRoutine(false);
    });
  };

  const handleApplyCarryOver = () => {
    if (dateKey !== todayDateKey || yesterdayIncompleteItems.length === 0 || isApplyingCarryOver || isApplyingRoutineAndCarryOver) {
      return;
    }
    setIsApplyingCarryOver(true);
    void handleDateAddTasks(yesterdayIncompleteItems).finally(() => {
      setIsApplyingCarryOver(false);
    });
  };

  const handleApplyRoutineAndCarryOver = () => {
    if (
      !assignedWeekdayRoutineTemplate?.id ||
      dateKey !== todayDateKey ||
      yesterdayIncompleteItems.length === 0 ||
      isApplyingCarryOver ||
      isApplyingRoutineAndCarryOver ||
      isApplyingWeekdayRoutine
    ) {
      return;
    }

    setIsApplyingRoutineAndCarryOver(true);
    void (async () => {
      await handleApplyRoutineTemplate(assignedWeekdayRoutineTemplate.id);
      await handleDateAddTasks(yesterdayIncompleteItems);
    })().finally(() => {
      setIsApplyingRoutineAndCarryOver(false);
    });
  };

  /**
   * 키보드 또는 손글씨 인식으로 만든 한 줄을 선택 날짜에 추가한다.
   * 추가된 항목이 입력 공간 위에 렌더링된 뒤 목록 끝으로 이동해, 같은 자리에서 다음 할 일을 이어서 적을 수 있게 한다.
   * 일회성 문구는 서버의 반복 사용 집계에 전달하며 30일 안에 서로 다른 3일 사용한 경우에만 관리 할 일 저장을 제안한다.
   */
  const handleInlineTodoAdd = async (label: string) => {
    setPendingWriteAnimation({
      existingIds: new Set(items.map((item) => item.id)),
      label,
    });
    const added = await handleDateAddTasks([{ label, taskId: null }]);
    if (!added) {
      setPendingWriteAnimation(null);
      return false;
    }

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        const scrollContainer = contentScrollRef.current;
        scrollContainer?.scrollTo({
          top: scrollContainer.scrollHeight,
          behavior: "smooth",
        });
      });
    });

    await promptTaskSuggestion(label);
    return true;
  };

  useEffect(() => {
    contentScrollRef.current?.scrollTo({ top: 0 });
  }, [dateKey]);

  return (
    <div className="date-todos-board relative min-h-0 flex-1 overflow-hidden rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
      <div
        ref={viewportRef}
        className="sketchbook-page-turn-viewport min-h-0 h-full overflow-hidden touch-pan-y"
        data-page-turn-direction={pageTurnDirection}
        style={pageTurnViewportStyle}
        onTouchStartCapture={handleBoardSwipeTouchStart}
        onTouchMoveCapture={handleBoardSwipeTouchMove}
        onTouchEndCapture={handleBoardSwipeTouchEnd}
        onTouchCancelCapture={handleBoardSwipeTouchCancel}
      >
        <div className="sketchbook-page-turn-underlay" aria-hidden="true">
          <div className="no-scrollbar min-h-0 h-full overflow-y-hidden pr-0.5">
            <PreviewTaskList
              items={pageTurnDirection === "previous" ? previousItems : nextItems}
              isLoading={
                pageTurnDirection === "previous"
                  ? previousQuery.isLoading
                  : nextQuery.isLoading
              }
            />
          </div>
        </div>

        <div
          className={`sketchbook-page-turn-sheet min-h-0 h-full ${isSettling ? "sketchbook-page-turn-sheet--settling" : ""}`}
          style={pageTurnStyle}
          onTransitionEnd={(event) => {
            if (event.currentTarget !== event.target || event.propertyName !== "transform") {
              return;
            }
            if (!isSettling) {
              return;
            }
            completePageTurn();
          }}
        >
          <div
            ref={contentScrollRef}
            className="date-todos-body-scroll no-scrollbar min-h-0 h-full space-y-2 overflow-y-auto overscroll-contain pr-0.5 touch-pan-y"
          >
            {isItemsHydrating ? (
              <div className="space-y-2">
                <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
                <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
                <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
              </div>
            ) : session.active === "rest" ? (
              <RestCoffeeScene restMinutes={session.restMinutes} />
            ) : items.length === 0 && isPastDate ? (
              <DateTodosEmptyState
                isPastDate={isPastDate}
                isFutureDate={isFutureDate}
                daysToToday={daysToToday}
                onShiftDate={onShiftDate}
                assignedWeekdayRoutineTemplate={
                  assignedWeekdayRoutineTemplate?.id
                    ? {
                        id: assignedWeekdayRoutineTemplate.id,
                        name: assignedWeekdayRoutineTemplate.name,
                      }
                    : null
                }
                weekdayRoutinePreviewItems={weekdayRoutinePreviewItems}
                isApplyingWeekdayRoutine={isApplyingWeekdayRoutine}
                isRoutineTemplatesLoading={isRoutineTemplatesLoading}
                onApplyWeekdayRoutine={handleApplyWeekdayRoutine}
                isToday={dateKey === todayDateKey}
                yesterdayIncompleteCount={yesterdayIncompleteCount}
                isApplyingCarryOver={isApplyingCarryOver}
                isApplyingRoutineAndCarryOver={isApplyingRoutineAndCarryOver}
                onApplyCarryOver={handleApplyCarryOver}
                onApplyRoutineAndCarryOver={handleApplyRoutineAndCarryOver}
                onOpenRoutineImport={openRoutineImport}
              />
            ) : items.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={(event) => setDraggingId(String(event.active.id))}
                onDragEnd={handleDragEnd}
                onDragCancel={clearDraggingState}
              >
                <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
                  <div className="todo-item-list space-y-2">
                    {visibleOrderedItems.map((item) => (
                      <SortableTaskRow
                        key={item.id}
                        item={item}
                        onTaskAction={handleDateTaskAction}
                        onTaskMenuAction={handleDateTaskMenuAction}
                        onDeleteGesture={queueGestureDelete}
                        disableActions={Boolean(draggingId)}
                        canRunFocus={!isFutureDate}
                        isLongPressActive={longPressActivatedId === item.id}
                        isWriteAnimating={writeAnimatingTaskId === item.id}
                        onWriteAnimationStarted={consumeWriteAnimation}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : null}
            {!isItemsHydrating && session.active !== "rest" && !isPastDate ? (
              <InlineTodoHandwritingComposer onAdd={handleInlineTodoAdd} />
            ) : null}
          </div>
          <div className="sketchbook-page-turn-sheet__back" aria-hidden="true" />
        </div>
      </div>
      {pendingGestureDeletion ? (
        <div className="todo-gesture-undo" data-disable-date-sheet-swipe="true" role="status">
          <span>할 일 아이템을 삭제했습니다</span>
          <button type="button" onClick={undoGestureDelete}>
            <FiRotateCcw size={13} />
            되돌리기
          </button>
        </div>
      ) : null}
    </div>
  );
}
