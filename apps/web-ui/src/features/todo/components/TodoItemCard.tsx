import {
  FiCheck,
  FiCheckCircle,
  FiCircle,
  FiMoreVertical,
  FiPause,
  FiPauseCircle,
  FiPlay,
  FiPlayCircle,
} from "react-icons/fi";
import type { TaskItem } from "../types";

type TodoItemCardProps = {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onOpenMenu: (taskId: string) => void;
  disableActions?: boolean;
  isDragging?: boolean;
  isLongPressActive?: boolean;
};

function renderStatusIcon(status: TaskItem["status"]) {
  if (status === "done") {
    return <FiCheckCircle size={18} className="text-success" />;
  }
  if (status === "in_progress") {
    return <FiPlayCircle size={18} className="text-info" />;
  }
  if (status === "paused") {
    return <FiPauseCircle size={18} className="text-warning" />;
  }
  return <FiCircle size={18} className="text-base-content/50" />;
}

function renderTaskActions(
  item: TaskItem,
  onTaskAction: TodoItemCardProps["onTaskAction"],
  disableActions = false
) {
  if (item.status === "todo") {
    return (
      <button
        type="button"
        className="btn btn-sm h-8 min-h-8 rounded-full border-info/35 bg-info/15 px-3 text-info"
        disabled={disableActions}
        onClick={() => onTaskAction(item.id, "start")}
      >
        <FiPlay size={13} />
        할일 시작
      </button>
    );
  }

  if (item.status === "in_progress") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="btn btn-sm h-8 min-h-8 rounded-full border-warning/35 bg-warning/15 px-3 text-warning"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "pause")}
        >
          <FiPause size={13} />
          중단
        </button>
        <button
          type="button"
          className="btn btn-sm h-8 min-h-8 rounded-full border-success/35 bg-success/15 px-3 text-success"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "complete")}
        >
          <FiCheck size={13} />
          완료
        </button>
      </div>
    );
  }

  if (item.status === "paused") {
    return (
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className="btn btn-sm h-8 min-h-8 rounded-full border-info/35 bg-info/15 px-3 text-info"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "resume")}
        >
          <FiPlay size={13} />
          재개
        </button>
        <button
          type="button"
          className="btn btn-sm h-8 min-h-8 rounded-full border-success/35 bg-success/15 px-3 text-success"
          disabled={disableActions}
          onClick={() => onTaskAction(item.id, "complete")}
        >
          <FiCheck size={13} />
          완료
        </button>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
      <FiCheckCircle size={12} />
      완료됨
    </div>
  );
}

export function TodoItemCard({
  item,
  onTaskAction,
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
            "m-0 flex-1 truncate text-sm text-base-content/90",
            item.status === "done" ? "text-base-content/55 line-through" : "",
          ].join(" ")}
        >
          {item.label}
        </p>
        <button
          type="button"
          aria-label="할일 옵션"
          className="btn btn-ghost btn-xs btn-square h-7 min-h-7 rounded-full text-base-content/70"
          onClick={() => onOpenMenu(item.id)}
          disabled={disableActions}
        >
          <FiMoreVertical size={13} />
        </button>
      </div>
      <div className="mt-2">{renderTaskActions(item, onTaskAction, disableActions)}</div>
    </div>
  );
}
