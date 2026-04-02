import { memo } from "react";
import { FiMoreVertical, FiTag } from "react-icons/fi";

type TaskManagementTaskItemProps = {
  label: string;
  collectionName: string;
  active?: boolean;
  onSelect?: () => void;
  onOpenMenu: () => void;
};

function TaskManagementTaskItemComponent({
  label,
  collectionName,
  active = false,
  onSelect,
  onOpenMenu,
}: TaskManagementTaskItemProps) {
  return (
    <div
      className={[
        "flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 transition-colors",
        active
          ? "border-primary/70 bg-primary/10 shadow-[0_0_0_1px_rgba(59,130,246,0.2)]"
          : "border-base-300/75 bg-base-100/85 hover:bg-base-100",
      ].join(" ")}
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect?.();
        }
      }}
    >
      <div className="min-w-0">
        <p className="m-0 truncate text-sm text-base-content/90">{label}</p>
        <p className="m-0 mt-0.5 text-[11px] text-base-content/55">
          <FiTag size={11} className="mr-1 inline-block" />
          {collectionName}
        </p>
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle h-7 min-h-7 w-7 min-w-7 text-base-content/55"
        onClick={(event) => {
          event.stopPropagation();
          onOpenMenu();
        }}
        aria-label="할일 옵션"
      >
        <FiMoreVertical size={13} />
      </button>
    </div>
  );
}

export const TaskManagementTaskItem = memo(
  TaskManagementTaskItemComponent,
  (prev, next) =>
    prev.label === next.label &&
    prev.collectionName === next.collectionName &&
    prev.active === next.active
);
