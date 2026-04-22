import { FiChevronLeft } from "react-icons/fi";
import { DateTodosRouteProvider } from "../DateTodosRouteProvider";
import {
  DateTodosRoutineCreateRouteLayer,
  DateTodosRoutineImportRouteLayer,
} from "./DateTodosRoutineRouteLayers";
import { DateTodosSwipeCloseLayer } from "./DateTodosSwipeCloseLayer";

type DateTodosRoutineStandaloneLayerProps = {
  dateKey: string;
  mode: "import" | "create";
  onClose: () => void;
  swipeCloseEnabled?: boolean;
};

export function DateTodosRoutineStandaloneLayer({
  dateKey,
  mode,
  onClose,
  swipeCloseEnabled = false,
}: DateTodosRoutineStandaloneLayerProps) {
  return (
    <DateTodosRouteProvider dateKey={dateKey}>
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
            {mode === "import" ? "루틴 불러오기" : "루틴 만들기"}
          </h2>
          <div />
        </header>
        <div className="min-h-0 flex flex-1 flex-col">
          {mode === "import" ? (
            <DateTodosRoutineImportRouteLayer onClose={onClose} />
          ) : (
            <DateTodosRoutineCreateRouteLayer onClose={onClose} />
          )}
        </div>
      </DateTodosSwipeCloseLayer>
    </DateTodosRouteProvider>
  );
}
