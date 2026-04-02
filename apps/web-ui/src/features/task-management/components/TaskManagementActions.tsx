import { FiPlus } from "react-icons/fi";
import { useTaskManagementView } from "../providers/TaskManagementViewProvider";

export function TaskManagementActions() {
  const { onOpenCollection, onOpenTaskPicker } = useTaskManagementView();
  return (
    <div className="flex w-full items-center justify-end gap-2 select-none">
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border-base-300/75 bg-base-200/55 px-4 text-sm text-base-content/85 shadow-none"
        onClick={onOpenCollection}
      >
        <FiPlus size={14} />
        컬렉션
      </button>
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border-base-300/75 bg-base-200/55 px-4 text-sm text-base-content/85 shadow-none"
        onClick={onOpenTaskPicker}
      >
        <FiPlus size={14} />
        할일
      </button>
    </div>
  );
}
