import {
  FiAlertCircle,
  FiCheck,
  FiCheckCircle,
  FiCircle,
  FiClock,
  FiMoreVertical,
  FiPause,
  FiPauseCircle,
  FiPlay,
  FiPlayCircle,
} from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import type { TaskItem } from "../types";

type TodoItemCardProps = {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onEditActualFocus?: (taskId: string) => void;
  onOpenMenu: (taskId: string) => void;
  disableActions?: boolean;
  isDragging?: boolean;
  isLongPressActive?: boolean;
};

function renderStatusIcon(status: TaskItem["status"]) {
  if (status === "done") {
    return <FiCheckCircle size={18} className="text-success" />;
  }
  if (status === "overdue") {
    return <FiAlertCircle size={18} className="text-error" />;
  }
  if (status === "in_progress") {
    return <FiPlayCircle size={18} className="text-info" />;
  }
  if (status === "paused") {
    return <FiPauseCircle size={18} className="text-warning" />;
  }
  return <FiCircle size={18} className="text-base-content/50" />;
}

function formatScheduledTime(epochMs: number) {
  const date = new Date(epochMs);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function renderTaskActions(
  item: TaskItem,
  onTaskAction: TodoItemCardProps["onTaskAction"],
  onEditActualFocus?: TodoItemCardProps["onEditActualFocus"],
  disableActions = false
) {
  if (item.status === "overdue") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="inline-flex items-center gap-1 rounded-full border border-error/35 bg-error/12 px-2.5 py-1 text-xs font-semibold text-error">
          <FiAlertCircle size={12} />
          미완료
        </div>
      </div>
    );
  }

  if (item.status === "todo") {
    return (
      <Button
        size="sm"
        className="h-8 min-h-8 rounded-full border-info/35 bg-info/15 px-3 text-info"
        disabled={disableActions}
        onClick={() => onTaskAction(item.id, "start")}
      >
        <FiPlay size={13} />
        할일 시작
      </Button>
    );
  }

  if (item.status === "in_progress") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className="h-8 min-h-8 rounded-full border-warning/35 bg-warning/15 px-3 text-warning"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "pause")}
        >
          <FiPause size={13} />
          중단
        </Button>
        <Button
          size="sm"
          className="h-8 min-h-8 rounded-full border-success/35 bg-success/15 px-3 text-success"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "complete")}
        >
          <FiCheck size={13} />
          완료
        </Button>
      </div>
    );
  }

  if (item.status === "paused") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <Button
          size="sm"
          className="h-8 min-h-8 rounded-full border-info/35 bg-info/15 px-3 text-info"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "resume")}
        >
          <FiPlay size={13} />
          재개
        </Button>
        <Button
          size="sm"
          className="h-8 min-h-8 rounded-full border-success/35 bg-success/15 px-3 text-success"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "complete")}
        >
          <FiCheck size={13} />
          완료
        </Button>
      </div>
    );
  }

  const actualFocusMinutes = Math.max(Math.round((item.completedDurationMs ?? item.accumulatedMs) / 60000), 0);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
        <FiCheckCircle size={12} />
        완료됨
      </div>
      <Button
        size="xs"
        className="h-7 min-h-7 rounded-full border-success/30 bg-base-100 px-2.5 text-success"
        disabled={disableActions}
        onClick={() => onEditActualFocus?.(item.id)}
      >
        집중 {actualFocusMinutes}분
      </Button>
    </div>
  );
}

export function TodoItemCard({
  item,
  onTaskAction,
  onEditActualFocus,
  onOpenMenu,
  disableActions = false,
  isDragging = false,
  isLongPressActive = false,
}: TodoItemCardProps) {
  return (
    <div
      className={[
        "rounded-lg border border-base-300/80 bg-base-100/85 px-3 py-2.5 transition-[box-shadow,transform,border-color] duration-200",
        item.status === "done" ? "bg-success/8" : "",
        item.status === "overdue" ? "border-error/35 bg-error/6" : "",
        item.status === "in_progress" ? "border-info/45" : "",
        isLongPressActive
          ? "border-primary/55 shadow-[0_0_0_1px_rgba(99,102,241,0.22),0_0_18px_rgba(99,102,241,0.22)]"
          : "",
        isDragging ? "scale-[1.015] border-primary/65 shadow-[0_0_0_1px_rgba(99,102,241,0.35),0_12px_28px_rgba(99,102,241,0.28)]" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        {renderStatusIcon(item.status)}
        <p
          className={[
            "m-0 min-w-0 flex-1 truncate text-sm text-base-content/90",
            item.status === "done" ? "text-base-content/55 line-through" : "",
            item.status === "overdue" ? "text-error/90" : "",
          ].join(" ")}
        >
          {item.label}
        </p>
        {item.scheduledStartAt ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-info/85">
            <FiClock size={11} />
            {formatScheduledTime(item.scheduledStartAt)}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="xs"
          square
          aria-label="할일 옵션"
          className="h-7 min-h-7 rounded-full text-base-content/70"
          onClick={() => onOpenMenu(item.id)}
          disabled={disableActions}
        >
          <FiMoreVertical size={13} />
        </Button>
      </div>
      <div className="mt-2">{renderTaskActions(item, onTaskAction, onEditActualFocus, disableActions)}</div>
    </div>
  );
}
