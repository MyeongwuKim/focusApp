import { useMemo } from "react";
import { toast } from "../../../stores";
import { TimePickerBottomSheet } from "../../../components/TimePickerBottomSheet";

type TodoScheduleTimeModalProps = {
  isOpen: boolean;
  dateKey: string;
  initialTime: string;
  onClose: () => void;
  onSave: (time: string) => void;
};

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

export function TodoScheduleTimeModal({
  isOpen,
  dateKey,
  initialTime,
  onClose,
  onSave,
}: TodoScheduleTimeModalProps) {
  const minTime = useMemo(() => {
    if (dateKey !== getTodayDateKey()) {
      return undefined;
    }
    const now = new Date(Date.now() + 60 * 1000);
    return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
  }, [dateKey, isOpen]);

  return (
    <TimePickerBottomSheet
      isOpen={isOpen}
      title="시작시간 설정"
      initialValue={initialTime}
      description={
        minTime ? "오늘은 현재 시각 이후로만 설정할 수 있어요." : "위로 스크롤해 시작시간을 선택해 주세요."
      }
      applyLabel="저장"
      onClose={onClose}
      onApply={(next) => {
        if (minTime && next < minTime) {
          toast.error("오늘은 현재 시각 이후로만 설정할 수 있어요.", "시작시간 안내");
          return false;
        }
        onSave(next);
        return true;
      }}
    />
  );
}
