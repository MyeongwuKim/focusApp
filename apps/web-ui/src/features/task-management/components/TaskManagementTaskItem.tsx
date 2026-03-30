import { FiMoreVertical, FiTag } from "react-icons/fi";

type TaskManagementTaskItemProps = {
  label: string;
  collectionName: string;
  onOpenMenu: () => void;
};

export function TaskManagementTaskItem({
  label,
  collectionName,
  onOpenMenu,
}: TaskManagementTaskItemProps) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-base-300/75 bg-base-100/85 px-2.5 py-2">
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
        onClick={onOpenMenu}
        aria-label="할일 옵션"
      >
        <FiMoreVertical size={13} />
      </button>
    </div>
  );
}
