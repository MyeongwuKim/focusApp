import { Button } from "../../../../components/ui/Button";

export type WeekdayRoutinePreviewItem = {
  id: string;
  content: string;
};

type WeekdayRoutinePreviewCardProps = {
  templateName: string;
  previewItems: WeekdayRoutinePreviewItem[];
  isApplying: boolean;
  disabled: boolean;
  onApply: () => void;
  applyLabel?: string;
};

export function WeekdayRoutinePreviewCard({
  templateName,
  previewItems,
  isApplying,
  disabled,
  onApply,
  applyLabel = "오늘 묶음 적용",
}: WeekdayRoutinePreviewCardProps) {
  return (
    <div className="weekday-routine-preview w-full max-w-sm space-y-2">
      <div className="weekday-routine-preview__copy space-y-1 text-center">
        <p className="m-0 pb-0.5 text-base font-semibold leading-snug text-base-content/85">
          오늘 사용할 묶음이 있어요.
        </p>
        <p className="m-0 text-xs text-base-content/60">아래 항목은 오늘 불러올 할 일 묶음 미리보기입니다.</p>
      </div>
      <div className="weekday-routine-preview__list rounded-lg border border-base-300/70 bg-base-200/45 p-2">
        <p className="m-0 truncate text-xs font-semibold text-base-content/70">{templateName}</p>
        <div className="mt-1.5 space-y-1 opacity-70">
          {previewItems.map((item) => (
            <div
              key={`weekday-routine-preview-${item.id}`}
              className="weekday-routine-preview__item truncate rounded-md border border-base-300/65 bg-base-100 px-2 py-0.5 text-xs text-base-content/70"
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
      <div className="flex w-full gap-2" data-disable-date-sheet-swipe="true">
        <Button variant="primary" className="date-todos-empty-state__action flex-1 rounded-lg" disabled={isApplying || disabled} onClick={onApply}>
          {isApplying ? "적용 중..." : applyLabel}
        </Button>
      </div>
    </div>
  );
}
