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
        <div className="routine-bundle-route min-h-0 flex flex-1 flex-col">
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
