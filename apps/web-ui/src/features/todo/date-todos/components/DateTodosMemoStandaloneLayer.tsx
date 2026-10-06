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
    <DateTodosSwipeCloseLayer
      onClose={onClose}
      swipeCloseEnabled={swipeCloseEnabled}
      background="transparent"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2 pb-[calc(0.5rem+var(--app-safe-area-bottom))]">
        <MemoEditorPanel
          dateKey={dateKey}
          className="h-full min-h-[22rem]"
        />
      </div>
    </DateTodosSwipeCloseLayer>
  );
}
