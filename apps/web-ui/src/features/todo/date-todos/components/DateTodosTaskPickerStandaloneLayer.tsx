import { DateTodosRouteProvider, useDateTodosRouteContext } from "../DateTodosRouteProvider";
import { TodoTaskPickerModal } from "../../components/TodoTaskPickerModal";
import { DateTodosSwipeCloseLayer } from "./DateTodosSwipeCloseLayer";

type DateTodosTaskPickerStandaloneLayerProps = {
  dateKey: string;
  onClose: () => void;
  swipeCloseEnabled?: boolean;
};

function DateTodosTaskPickerStandaloneContent({
  onClose,
  swipeCloseEnabled,
}: {
  onClose: () => void;
  swipeCloseEnabled: boolean;
}) {
  const { handleDateAddTasks } = useDateTodosRouteContext();

  return (
    <DateTodosSwipeCloseLayer onClose={onClose} swipeCloseEnabled={swipeCloseEnabled}>
      <TodoTaskPickerModal
        isOpen
        onClose={onClose}
        onApply={handleDateAddTasks}
      />
    </DateTodosSwipeCloseLayer>
  );
}

export function DateTodosTaskPickerStandaloneLayer({
  dateKey,
  onClose,
  swipeCloseEnabled = false,
}: DateTodosTaskPickerStandaloneLayerProps) {
  return (
    <DateTodosRouteProvider dateKey={dateKey}>
      <DateTodosTaskPickerStandaloneContent
        onClose={onClose}
        swipeCloseEnabled={swipeCloseEnabled}
      />
    </DateTodosRouteProvider>
  );
}
