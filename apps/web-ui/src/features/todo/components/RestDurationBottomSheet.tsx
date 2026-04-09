import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

type RestDurationBottomSheetProps = {
  isOpen: boolean;
  currentDurationMin: number | null;
  defaultDurationMin: number | null;
  onClose: () => void;
  onApplyOnce: (nextDurationMin: number | null) => void;
  onSaveDefault: (nextDurationMin: number | null) => void;
};

const PRESET_REST_DURATIONS: Array<number | null> = [null, 30, 60, 120];

function formatRestDurationLabel(durationMin: number | null) {
  if (durationMin === null) {
    return "무제한";
  }
  return `${durationMin}분`;
}

export function RestDurationBottomSheet({
  isOpen,
  currentDurationMin,
  defaultDurationMin,
  onClose,
  onApplyOnce,
  onSaveDefault,
}: RestDurationBottomSheetProps) {
  const [draftDurationMin, setDraftDurationMin] = useState<number | null>(currentDurationMin);
  const [customMinutesInput, setCustomMinutesInput] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setDraftDurationMin(currentDurationMin);
    if (currentDurationMin !== null && !PRESET_REST_DURATIONS.includes(currentDurationMin)) {
      setCustomMinutesInput(String(currentDurationMin));
      return;
    }
    setCustomMinutesInput("");
  }, [currentDurationMin, isOpen]);

  const applyCustomMinutes = () => {
    const nextValue = Number.parseInt(customMinutesInput.trim(), 10);
    if (!Number.isFinite(nextValue) || nextValue <= 0) {
      return;
    }
    setDraftDurationMin(Math.min(nextValue, 999));
  };

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="action-sheet-overlay" role="presentation">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
        aria-label="휴식 시간 설정 닫기"
        onClick={onClose}
      />
      <div className="action-sheet-panel border border-base-300 bg-base-100 text-base-content">
        <div className="px-1 pb-1">
          <p className="m-0 text-sm font-semibold">휴식 시간 설정</p>
          <p className="mt-0.5 mb-0 text-xs text-base-content/60">
            기본값: {formatRestDurationLabel(defaultDurationMin)}
          </p>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESET_REST_DURATIONS.map((duration) => (
            <Button
              key={duration === null ? "unlimited" : duration}
              size="sm"
              variant={draftDurationMin === duration ? "primary" : "ghost"}
              className={[
                "h-8 min-h-8 rounded-full px-3 text-xs",
                draftDurationMin === duration
                  ? "border-primary/55 bg-primary/16 text-primary"
                  : "border border-base-300/80 bg-base-100 text-base-content/72",
              ].join(" ")}
              onClick={() => setDraftDurationMin(duration)}
            >
              {formatRestDurationLabel(duration)}
            </Button>
          ))}
        </div>

        <div className="mt-2 flex items-center gap-2 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
          <InputField
            type="number"
            min={1}
            max={999}
            step={1}
            inputMode="numeric"
            value={customMinutesInput}
            onChange={(event) => setCustomMinutesInput(event.target.value)}
            className="input-sm h-9 min-h-9 w-full border-base-300 bg-base-100"
            placeholder="커스텀 분 입력 (예: 45)"
          />
          <Button size="sm" className="h-9 min-h-9 rounded-full px-3 text-xs" onClick={applyCustomMinutes}>
            적용
          </Button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button
            size="sm"
            className="h-9 min-h-9 rounded-full border border-base-300 bg-base-100 text-xs"
            onClick={() => {
              onApplyOnce(draftDurationMin);
              onClose();
            }}
          >
            이번만 적용
          </Button>
          <Button
            size="sm"
            variant="primary"
            className="h-9 min-h-9 rounded-full text-xs"
            onClick={() => {
              onSaveDefault(draftDurationMin);
              onClose();
            }}
          >
            기본값 저장
          </Button>
        </div>
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
