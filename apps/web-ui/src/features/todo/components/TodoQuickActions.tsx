import { PillActionButton } from "../../../components/ui/PillActionButton";
import { AppFeatureIcon } from "../../../components/ui/AppFeatureIcon";

type TodoQuickActionsProps = {
  onOpenMemo: () => void;
  onOpenTaskPicker: () => void;
  onOpenRoutineImport: () => void;
};

export function TodoQuickActions({
  onOpenMemo,
  onOpenTaskPicker,
  onOpenRoutineImport,
}: TodoQuickActionsProps) {
  return (
    <div className="todo-quick-actions grid grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
      <PillActionButton
        compact
        icon={<AppFeatureIcon name="tasks" />}
        className="todo-quick-actions__write justify-start px-4"
        onClick={onOpenTaskPicker}
      >
        저장한 할 일
      </PillActionButton>
      <PillActionButton
        compact
        icon={<AppFeatureIcon name="routine" />}
        className="todo-quick-actions__secondary"
        onClick={onOpenRoutineImport}
      >
        묶음
      </PillActionButton>
      <PillActionButton compact icon={<AppFeatureIcon name="memo" />} className="todo-quick-actions__secondary" onClick={onOpenMemo}>
        메모
      </PillActionButton>
    </div>
  );
}
