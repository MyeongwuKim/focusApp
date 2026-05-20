import { FiClipboard, FiDownload } from "react-icons/fi";
import { Button } from "../../../../components/ui/Button";
import { WeekdayRoutinePreviewCard, type WeekdayRoutinePreviewItem } from "./WeekdayRoutinePreviewCard";

type DateTodosEmptyStateProps = {
  isPastDate: boolean;
  isFutureDate: boolean;
  daysToToday: number;
  onShiftDate: (days: number) => void;
  assignedWeekdayRoutineTemplate: { id: string; name: string } | null;
  weekdayRoutinePreviewItems: WeekdayRoutinePreviewItem[];
  isApplyingWeekdayRoutine: boolean;
  isRoutineTemplatesLoading: boolean;
  onApplyWeekdayRoutine: () => void;
  onOpenRoutineImport: () => void;
};

export function DateTodosEmptyState({
  isPastDate,
  isFutureDate,
  daysToToday,
  onShiftDate,
  assignedWeekdayRoutineTemplate,
  weekdayRoutinePreviewItems,
  isApplyingWeekdayRoutine,
  isRoutineTemplatesLoading,
  onApplyWeekdayRoutine,
  onOpenRoutineImport,
}: DateTodosEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
        <FiClipboard size={20} />
      </span>
      {isPastDate ? (
        <>
          <div className="space-y-1">
            <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">지난 날짜에 등록된 할일이 없어요</p>
            <p className="m-0 text-xs text-base-content/60">
              이 날짜는 기록 확인용으로 두고, 오늘 계획을 먼저 잡아보는 게 좋아요.
            </p>
          </div>
          <div className="flex w-full max-w-xs gap-2" data-disable-date-sheet-swipe="true">
            <Button
              variant="primary"
              className="flex-1 rounded-lg"
              onClick={() => {
                if (daysToToday !== 0) {
                  onShiftDate(daysToToday);
                }
              }}
            >
              오늘로 이동
            </Button>
          </div>
        </>
      ) : assignedWeekdayRoutineTemplate ? (
        <WeekdayRoutinePreviewCard
          templateName={assignedWeekdayRoutineTemplate.name}
          previewItems={weekdayRoutinePreviewItems}
          isApplying={isApplyingWeekdayRoutine}
          disabled={isRoutineTemplatesLoading}
          onApply={onApplyWeekdayRoutine}
        />
      ) : (
        <>
          <div className="space-y-1">
            <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">
              {isFutureDate ? "이 날짜에 예정된 할일이 없어요" : "오늘 할 일이 비어 있어요"}
            </p>
            <p className="m-0 text-xs text-base-content/60">먼저 오늘에 사용할 루틴을 불러와보세요.</p>
          </div>
          <div className="flex w-full max-w-xs gap-2" data-disable-date-sheet-swipe="true">
            <Button variant="primary" className="flex-1 rounded-lg" onClick={onOpenRoutineImport}>
              <FiDownload size={13} />
              루틴 불러오기
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
