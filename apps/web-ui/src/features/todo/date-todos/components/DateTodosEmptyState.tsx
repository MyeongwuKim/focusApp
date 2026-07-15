import { FiClipboard, FiDownload, FiRotateCcw } from "react-icons/fi";
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
  isToday: boolean;
  yesterdayIncompleteCount: number;
  isApplyingCarryOver: boolean;
  isApplyingRoutineAndCarryOver: boolean;
  onApplyCarryOver: () => void;
  onApplyRoutineAndCarryOver: () => void;
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
  isToday,
  yesterdayIncompleteCount,
  isApplyingCarryOver,
  isApplyingRoutineAndCarryOver,
  onApplyCarryOver,
  onApplyRoutineAndCarryOver,
  onOpenRoutineImport,
}: DateTodosEmptyStateProps) {
  return (
    <div className="flex min-h-full flex-col items-center justify-center gap-3 px-3 py-4 text-center">
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
        <FiClipboard size={20} />
      </span>
      {isPastDate ? (
        <>
          <div className="space-y-1">
            <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">이 날짜에 기록된 할 일이 없어요</p>
            <p className="m-0 text-xs text-base-content/60">
              지난 날짜는 기록만 확인할 수 있어요.
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
        <div className="w-full max-w-sm space-y-3">
          <WeekdayRoutinePreviewCard
            templateName={assignedWeekdayRoutineTemplate.name}
            previewItems={weekdayRoutinePreviewItems}
            isApplying={isApplyingWeekdayRoutine}
            disabled={isRoutineTemplatesLoading}
            onApply={onApplyWeekdayRoutine}
            applyLabel={isToday && yesterdayIncompleteCount > 0 ? "루틴만 적용" : "오늘 루틴 적용"}
          />
          {isToday && yesterdayIncompleteCount > 0 ? (
            <div className="space-y-4 px-1 pt-1">
              <p className="m-0 pb-1 text-center text-[10px] leading-relaxed text-base-content/62">
                어제 미완료 {yesterdayIncompleteCount}개도 같이 가져올 수 있어요.
              </p>
              <Button
                variant="primary"
                className="h-9 min-h-9 w-full rounded-lg text-xs"
                disabled={isApplyingCarryOver || isApplyingRoutineAndCarryOver || isApplyingWeekdayRoutine}
                onClick={onApplyRoutineAndCarryOver}
              >
                {isApplyingRoutineAndCarryOver ? "불러오는 중..." : "루틴 + 미완료 함께 가져오기"}
              </Button>
              <Button
                variant="ghost"
                className="h-8 min-h-8 w-full rounded-lg text-xs"
                disabled={isApplyingCarryOver || isApplyingRoutineAndCarryOver || isApplyingWeekdayRoutine}
                onClick={onApplyCarryOver}
              >
                <FiRotateCcw size={12} />
                미완료만 가져오기
              </Button>
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">
              {isFutureDate ? "이 날짜에 예정된 할 일이 없어요" : "오늘 할 일이 비어 있어요"}
            </p>
            <p className="m-0 text-xs text-base-content/60">
              {isToday && yesterdayIncompleteCount > 0
                ? `어제 미완료 ${yesterdayIncompleteCount}개를 먼저 가져오거나 루틴을 불러올 수 있어요.`
                : isFutureDate
                  ? "이 날짜에 맞는 루틴을 불러와 보세요."
                  : "오늘 루틴을 불러와 할 일을 채워보세요."}
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-1 gap-2 sm:grid-cols-2" data-disable-date-sheet-swipe="true">
            {isToday && yesterdayIncompleteCount > 0 ? (
              <>
                <Button
                  variant="primary"
                  className="w-full rounded-lg whitespace-nowrap"
                  disabled={isApplyingCarryOver || isApplyingRoutineAndCarryOver}
                  onClick={onApplyCarryOver}
                >
                  <FiRotateCcw size={13} />
                  미완료 가져오기
                </Button>
                <Button variant="ghost" className="w-full rounded-lg whitespace-nowrap" onClick={onOpenRoutineImport}>
                  <FiDownload size={13} />
                  루틴 불러오기
                </Button>
              </>
            ) : (
              <Button variant="primary" className="flex-1 rounded-lg" onClick={onOpenRoutineImport}>
                <FiDownload size={13} />
                루틴 불러오기
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
