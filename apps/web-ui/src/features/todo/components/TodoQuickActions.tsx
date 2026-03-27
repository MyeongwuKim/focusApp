import { FiClock, FiFileText, FiPlus } from "react-icons/fi";

type TodoQuickActionsProps = {
  onOpenMemo: () => void;
};

export function TodoQuickActions({ onOpenMemo }: TodoQuickActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border border-base-300/70 bg-base-300/45 px-3 text-xs text-base-content/85 shadow-none"
      >
        <FiClock size={13} />
        휴식
      </button>
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border border-base-300/70 bg-base-300/45 px-3 text-xs text-base-content/85 shadow-none"
      >
        <FiPlus size={13} />
        할일+
      </button>
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border border-base-300/70 bg-base-300/45 px-3 text-xs text-base-content/85 shadow-none"
        onClick={onOpenMemo}
      >
        <FiFileText size={13} />
        메모
      </button>
    </div>
  );
}
