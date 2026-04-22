import { TodoRoutineCreateModal } from "../../components/TodoRoutineCreateModal";
import { TodoRoutineImportModal } from "../../components/TodoRoutineImportModal";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

type DateTodosRoutineRouteLayerProps = {
  onClose: () => void;
};

export function DateTodosRoutineImportRouteLayer({ onClose }: DateTodosRoutineRouteLayerProps) {
  const {
    routineTemplates,
    isRoutineTemplatesLoading,
    handleApplyRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,
  } = useDateTodosRouteContext();

  return (
    <TodoRoutineImportModal
      routines={routineTemplates}
      isLoading={isRoutineTemplatesLoading}
      onClose={onClose}
      onApply={handleApplyRoutineTemplate}
      onUpdateRoutine={handleUpdateRoutineTemplate}
      onDeleteRoutine={handleDeleteRoutineTemplate}
    />
  );
}

export function DateTodosRoutineCreateRouteLayer({ onClose }: DateTodosRoutineRouteLayerProps) {
  const { handleCreateRoutineTemplate } = useDateTodosRouteContext();

  return (
    <TodoRoutineCreateModal
      onClose={onClose}
      onCreate={handleCreateRoutineTemplate}
    />
  );
}
