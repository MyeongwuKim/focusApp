import { memo } from "react";
import { FiMoreVertical } from "react-icons/fi";

type TaskManagementCollectionItemProps = {
  name: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onOpenMenu?: () => void;
};

function TaskManagementCollectionItemComponent({
  name,
  count,
  active,
  onSelect,
  onOpenMenu,
}: TaskManagementCollectionItemProps) {
  return (
    <div
      className={[
        "flex items-center gap-1 rounded-lg border px-1 py-1",
        active ? "border-primary/60 bg-primary/16" : "border-base-300/70 bg-base-100/75",
      ].join(" ")}
    >
      <button
        type="button"
        className={[
          "btn btn-sm h-10 min-h-10 min-w-0 flex-1 border-transparent bg-transparent px-1 text-[11px] shadow-none",
          active ? "text-primary" : "text-base-content/70",
        ].join(" ")}
        onClick={onSelect}
      >
        <span className="flex w-full items-center justify-between gap-1">
          <span className="max-h-8 overflow-hidden whitespace-normal break-words text-left leading-tight">
            {name}
          </span>
          <span className="shrink-0 rounded-md bg-base-300/60 px-1.5 py-0.5 text-[10px] leading-none text-base-content/80">
            {count}
          </span>
        </span>
      </button>
      {onOpenMenu ? (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-circle h-7 min-h-7 w-7 min-w-7 border-transparent bg-transparent text-base-content/55 shadow-none"
          onClick={onOpenMenu}
          aria-label="컬렉션 옵션"
        >
          <FiMoreVertical size={12} />
        </button>
      ) : null}
    </div>
  );
}

export const TaskManagementCollectionItem = memo(
  TaskManagementCollectionItemComponent,
  (prev, next) =>
    prev.name === next.name &&
    prev.count === next.count &&
    prev.active === next.active &&
    Boolean(prev.onOpenMenu) === Boolean(next.onOpenMenu)
);
