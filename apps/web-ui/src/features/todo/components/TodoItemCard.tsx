import {
  FiAlertCircle,
  FiBellOff,
  FiCheckCircle,
  FiClock,
  FiEdit2,
  FiPause,
  FiPlay,
  FiTarget,
} from "react-icons/fi";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { useTodoItemPenGesture } from "../hooks/useTodoItemPenGesture";
import type { TaskItem } from "../types";

type TodoItemCardProps = {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onOpenMenu: (taskId: string) => void;
  onDeleteGesture?: (taskId: string) => void;
  disableActions?: boolean;
  canRunFocus?: boolean;
  isDragging?: boolean;
  isLongPressActive?: boolean;
  isWriteAnimating?: boolean;
  onWriteAnimationStarted?: (taskId: string) => void;
};

function renderStatusIcon(status: TaskItem["status"]) {
  if (status === "done") {
    return <FiCheckCircle size={18} className="text-success" />;
  }
  if (status === "overdue") {
    return <FiAlertCircle size={18} className="text-error" />;
  }
  if (status === "in_progress") {
    return <FiPause size={13} className="text-warning" />;
  }
  if (status === "paused") {
    return <FiPlay size={14} className="text-info" />;
  }
  return <FiPlay size={14} className="text-warning" />;
}

function formatScheduledTime(epochMs: number) {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function buildTargetFocusBadgeText(item: TaskItem) {
  if (!item.targetFocusMinutes) {
    return null;
  }

  if (item.status === "done" || item.status === "overdue") {
    return null;
  }

  if (item.status !== "in_progress" || !item.startedAt) {
    return `${item.targetFocusMinutes}분`;
  }

  const deviationSeconds =
    typeof item.deviationSeconds === "number" && Number.isFinite(item.deviationSeconds)
      ? Math.max(Math.floor(item.deviationSeconds), 0)
      : 0;
  const baselineSeconds =
    typeof item.targetFocusBaselineSeconds === "number" && Number.isFinite(item.targetFocusBaselineSeconds)
      ? Math.max(Math.floor(item.targetFocusBaselineSeconds), 0)
      : 0;
  const actualFocusSeconds = Math.max(Math.floor((Date.now() - item.startedAt) / 1000) - deviationSeconds, 0);
  const effectiveActualFocusSeconds = Math.max(actualFocusSeconds - baselineSeconds, 0);
  const targetSeconds = item.targetFocusMinutes * 60;
  const overflowSeconds = effectiveActualFocusSeconds - targetSeconds;

  if (overflowSeconds <= 0) {
    return `${item.targetFocusMinutes}분`;
  }

  const overflowMinutes = Math.max(Math.floor(overflowSeconds / 60), 1);
  return `초과 +${overflowMinutes}분`;
}

function renderTaskActions(item: TaskItem, canRunFocus = true) {
  if (item.status === "overdue") {
    return null;
  }

  if (item.status === "todo") {
    if (!canRunFocus) {
      return (
        <div className="todo-item-card__state inline-flex items-center gap-1 rounded-full border border-base-300/80 bg-base-200/65 px-2.5 py-1 text-xs font-semibold text-base-content/65">
          <FiClock size={12} />
          예정
        </div>
      );
    }

    return null;
  }

  if (item.status === "in_progress") {
    return null;
  }

  if (item.status === "paused") {
    return null;
  }

  return null;
}

export function TodoItemCard({
  item,
  onTaskAction,
  onOpenMenu,
  onDeleteGesture,
  disableActions = false,
  canRunFocus = true,
  isDragging = false,
  isLongPressActive = false,
  isWriteAnimating = false,
  onWriteAnimationStarted,
}: TodoItemCardProps) {
  const targetFocusBadgeText = buildTargetFocusBadgeText(item);
  const actualFocusMinutes = Math.max(Math.round((item.completedDurationMs ?? item.accumulatedMs) / 60000), 0);
  const isMutedToday =
    typeof item.muteReminderDateKey === "string" &&
    item.muteReminderDateKey.length > 0 &&
    item.muteReminderDateKey === formatTodayDateKey() &&
    item.status !== "done";
  const canCompleteWithGesture =
    item.status !== "done" && (canRunFocus || item.status === "overdue") && !disableActions;
  const {
    gestureProps,
    gestureZoneProps,
    strokePath,
    strokeTone,
    isDeleteGuideVisible,
    isGestureHelpVisible,
  } = useTodoItemPenGesture({
    disabled: disableActions || !onDeleteGesture,
    canComplete: canCompleteWithGesture,
    onComplete: () => onTaskAction(item.id, "complete"),
    onDelete: () => onDeleteGesture?.(item.id),
  });
  const writeDurationMs = Math.min(Math.max(560 + Array.from(item.label).length * 38, 760), 1250);
  const writeAnimationStyle = {
    "--todo-write-duration": `${writeDurationMs}ms`,
    "--todo-write-delay": "140ms",
    "--todo-meta-delay": `${Math.min(320 + writeDurationMs * 0.72, 1050)}ms`,
  } as CSSProperties;
  const writeAnimationStartedRef = useRef(false);
  const [isWriteAnimationPlaying, setIsWriteAnimationPlaying] = useState(isWriteAnimating);
  const isWriteEffectActive = isWriteAnimating || isWriteAnimationPlaying;

  /**
   * 새 항목이 처음 화면에 나타난 순간 부모의 대기 상태를 소비하고, 카드 안에서는 효과가 끝날 때까지 재생 상태를 유지한다.
   * 이후 목록 재조회로 카드가 다시 만들어져도 부모 상태가 이미 비어 있으므로 같은 글씨 쓰기 효과가 반복되지 않는다.
   */
  useEffect(() => {
    if (!isWriteAnimating || writeAnimationStartedRef.current) {
      return;
    }

    writeAnimationStartedRef.current = true;
    onWriteAnimationStarted?.(item.id);
  }, [isWriteAnimating, item.id, onWriteAnimationStarted]);

  // 부모가 재생권을 소비해도 카드 안의 효과는 정해진 길이만큼 유지한 뒤 종료한다.
  useEffect(() => {
    if (!isWriteAnimationPlaying) {
      return;
    }
    const timer = window.setTimeout(() => {
      setIsWriteAnimationPlaying(false);
    }, writeDurationMs + 320);
    return () => window.clearTimeout(timer);
  }, [isWriteAnimationPlaying, writeDurationMs]);
  const focusAction = !canRunFocus || disableActions
    ? null
    : item.status === "todo"
      ? "start"
      : item.status === "in_progress"
        ? "pause"
        : item.status === "paused"
          ? "resume"
          : null;
  const focusActionText = focusAction === "start"
    ? "집중 시작"
    : focusAction === "pause"
      ? "집중 일시정지"
      : focusAction === "resume"
        ? "집중 재개"
        : undefined;
  const taskActions = renderTaskActions(item, canRunFocus);

  const activateFocusAction = () => {
    if (focusAction) {
      onTaskAction(item.id, focusAction);
    }
  };

  /** 할 일 글자 영역은 숨겨진 더보기 버튼을 대신해 해당 항목의 수정·시간·알림 옵션을 연다. */
  const activateTaskOptions = () => {
    if (!disableActions) {
      onOpenMenu(item.id);
    }
  };

  return (
    <div
      {...gestureProps}
      data-task-status={item.status}
      data-write-animating={isWriteEffectActive ? "true" : "false"}
      style={writeAnimationStyle}
      className={[
        "todo-item-card rounded-lg border border-base-300/80 bg-base-100/85 px-3 py-2.5 transition-[box-shadow,transform,border-color] duration-200",
        item.status === "done" ? "bg-success/8" : "",
        item.status === "overdue" ? "border-error/35 bg-error/6" : "",
        item.status === "in_progress" ? "border-info/45" : "",
        isLongPressActive
          ? "border-primary/55 shadow-[0_0_0_1px_rgba(99,102,241,0.22),0_0_18px_rgba(99,102,241,0.22)]"
          : "",
        isDragging ? "scale-[1.015] border-primary/65 shadow-[0_0_0_1px_rgba(99,102,241,0.35),0_12px_28px_rgba(99,102,241,0.28)]" : "",
      ].join(" ")}
    >
      <svg
        className={`todo-item-card__gesture-stroke todo-item-card__gesture-stroke--${strokeTone}`}
        aria-hidden="true"
      >
        <path d={strokePath} />
      </svg>
      <div
        {...gestureZoneProps}
        className="todo-item-card__gesture-zone"
        data-delete-guide-visible={isDeleteGuideVisible ? "true" : "false"}
        data-help-visible={isGestureHelpVisible ? "true" : "false"}
        role={!disableActions && onDeleteGesture ? "button" : undefined}
        tabIndex={!disableActions && onDeleteGesture ? 0 : -1}
        aria-label={
          !disableActions && onDeleteGesture
            ? "그리기 제스처 안내: V를 그리면 완료, 가로선을 길게 그으면 삭제"
            : undefined
        }
        aria-expanded={!disableActions && onDeleteGesture ? isGestureHelpVisible : undefined}
      >
        {!disableActions && onDeleteGesture ? (
          <>
            <span className="todo-item-card__gesture-affordance" aria-hidden="true">
              <FiEdit2 size={11} />
              <span>빠른 동작</span>
            </span>
            <span
              className="todo-item-card__gesture-help"
              aria-hidden={!isGestureHelpVisible}
            >
              <span>V 그리기 → 완료</span>
              <span>가로선 → 삭제</span>
            </span>
          </>
        ) : null}
      </div>
      <div className="todo-item-card__main-row relative z-[1] flex items-center gap-2">
        <button
          type="button"
          className="todo-item-card__status"
          aria-label={
            focusActionText ??
            (item.status === "done"
              ? "완료된 할 일"
              : item.status === "overdue"
                ? "미완료된 할 일"
                : "집중 동작을 사용할 수 없는 할 일")
          }
          disabled={!focusAction}
          onClick={activateFocusAction}
        >
          {isWriteEffectActive ? (
            <svg className="todo-item-card__status-ring" viewBox="0 0 28 28" aria-hidden="true">
              <circle cx="14" cy="14" r="10.5" pathLength="1" />
            </svg>
          ) : null}
          {renderStatusIcon(item.status)}
        </button>
        <div
          className="todo-item-card__label-slot min-w-0 flex-1"
          data-actionable={!disableActions ? "true" : "false"}
          role={!disableActions ? "button" : undefined}
          tabIndex={!disableActions ? 0 : undefined}
          aria-label={!disableActions ? `${item.label}, 할 일 옵션 열기` : undefined}
          title={!disableActions ? "할 일 옵션" : undefined}
          onClick={activateTaskOptions}
          onKeyDown={(event) => {
            if (disableActions || (event.key !== "Enter" && event.key !== " ")) {
              return;
            }
            event.preventDefault();
            activateTaskOptions();
          }}
        >
          <span className="todo-item-card__label-ink">
            <p
              className={[
                "m-0 block max-w-full whitespace-normal break-words text-sm text-base-content/90",
                item.status === "done" ? "text-base-content/55 line-through" : "",
                item.status === "overdue" ? "text-error/90" : "",
              ].join(" ")}
            >
              {item.label}
            </p>
            {isWriteEffectActive ? (
              <span className="todo-item-card__writing-pencil" aria-hidden="true">
                <FiEdit2 />
              </span>
            ) : null}
          </span>
        </div>
        {item.scheduledStartAt ? (
          <span className="todo-item-card__scheduled-time todo-item-card__meta inline-flex shrink-0 items-center gap-1">
            <FiClock size={11} />
            <span>{formatScheduledTime(item.scheduledStartAt)}</span>
          </span>
        ) : null}
        {targetFocusBadgeText ? (
          <span className="todo-item-card__meta inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-warning/85">
            <FiTarget size={11} />
            {targetFocusBadgeText}
          </span>
        ) : null}
        {isMutedToday ? (
          <span
            className="todo-item-card__muted-reminder todo-item-card__meta inline-flex shrink-0 items-center justify-center"
            aria-label="오늘 알림 안 받기"
            title="오늘 알림 안 받기"
          >
            <FiBellOff size={12} />
          </span>
        ) : null}
        {item.status === "done" ? (
          <span className="todo-item-card__completed-focus shrink-0" aria-label={`실제 집중 시간 ${actualFocusMinutes}분`}>
            집중 {actualFocusMinutes}분
          </span>
        ) : null}
      </div>
      {taskActions ? (
        <div className="todo-item-card__actions relative z-[1] mt-2">
          {taskActions}
        </div>
      ) : null}
    </div>
  );
}
