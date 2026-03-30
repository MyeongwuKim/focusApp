import { FiMoreVertical } from "react-icons/fi";

type TaskManagementCollectionItemProps = {
  name: string;
  count: number;
  active: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
};

export function TaskManagementCollectionItem({
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
          "btn btn-sm h-7 min-h-7 min-w-0 flex-1 border-transparent bg-transparent px-1 text-[11px] shadow-none",
          active ? "text-primary" : "text-base-content/70",
        ].join(" ")}
        onClick={onSelect}
      >
        <span className="truncate">{`${name} ${count}`}</span>
      </button>
      <button
        type="button"
        className="btn btn-ghost btn-xs btn-circle h-7 min-h-7 w-7 min-w-7 border-transparent bg-transparent text-base-content/55 shadow-none"
        onClick={onOpenMenu}
        aria-label="컬렉션 옵션"
      >
        <FiMoreVertical size={12} />
      </button>
    </div>
  );
}
