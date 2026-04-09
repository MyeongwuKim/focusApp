import { FiClock, FiFileText, FiPlus } from "react-icons/fi";
import { PillActionButton } from "../../../components/ui/PillActionButton";

type TodoQuickActionsProps = {
  onOpenMemo: () => void;
  onOpenTaskPicker: () => void;
  onOpenRestSettings: () => void;
};

export function TodoQuickActions({
  onOpenMemo,
  onOpenTaskPicker,
  onOpenRestSettings,
}: TodoQuickActionsProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <PillActionButton compact icon={<FiClock size={13} />} onClick={onOpenRestSettings}>
        휴식
      </PillActionButton>
      <PillActionButton compact icon={<FiPlus size={13} />} onClick={onOpenTaskPicker}>
        할일+
      </PillActionButton>
      <PillActionButton compact icon={<FiFileText size={13} />} onClick={onOpenMemo}>
        메모
      </PillActionButton>
    </div>
  );
}
