import { FiChevronLeft } from "react-icons/fi";
import { MemoEditorPanel } from "../../../memo/containers/MemoEditorPanel";
import { DateTodosSwipeCloseLayer } from "./DateTodosSwipeCloseLayer";

type DateTodosMemoStandaloneLayerProps = {
  dateKey: string;
  onClose: () => void;
  swipeCloseEnabled?: boolean;
};

export function DateTodosMemoStandaloneLayer({
  dateKey,
  onClose,
  swipeCloseEnabled = false,
}: DateTodosMemoStandaloneLayerProps) {
  return (
    <DateTodosSwipeCloseLayer onClose={onClose} swipeCloseEnabled={swipeCloseEnabled}>
      <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-base-300/80 px-2">
        <button
          type="button"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base-content/70 transition-colors hover:bg-base-200/70"
          aria-label="뒤로가기"
          onClick={onClose}
        >
          <FiChevronLeft size={18} />
        </button>
        <h2 className="m-0 truncate px-2 text-center text-[17px] font-semibold text-base-content">
          {dateKey} 메모
        </h2>
        <div />
      </header>
      <div className="min-h-0 flex-1 p-2">
        <MemoEditorPanel
          dateKey={dateKey}
          className="h-full rounded-xl border-base-300/70 bg-base-200/35 p-2.5"
        />
      </div>
    </DateTodosSwipeCloseLayer>
  );
}
