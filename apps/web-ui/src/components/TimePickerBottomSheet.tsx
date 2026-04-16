import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { WheelPicker, WheelPickerWrapper, type WheelPickerOption } from "@ncdai/react-wheel-picker";
import "@ncdai/react-wheel-picker/style.css";

const MERIDIEMS = ["오전", "오후"] as const;
const HOURS_12 = Array.from({ length: 12 }, (_, index) => String(index + 1));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

type PickerValue = {
  meridiem: (typeof MERIDIEMS)[number];
  hour: string;
  minute: string;
};

function toPickerValue(hhmm: string): PickerValue {
  const matched = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(hhmm);
  if (!matched) {
    return { meridiem: "오전", hour: "9", minute: "00" };
  }

  const hour24 = Number(matched[1]);
  const minute = matched[2];
  const isPm = hour24 >= 12;
  const hour12 = hour24 % 12 || 12;

  return {
    meridiem: isPm ? "오후" : "오전",
    hour: String(hour12),
    minute,
  };
}

function toHHmm(value: PickerValue) {
  const hour12 = Number(value.hour);
  const minute = value.minute;
  const normalizedHour = Number.isFinite(hour12) ? Math.min(12, Math.max(1, hour12)) : 12;
  const hour24 =
    value.meridiem === "오후" ? (normalizedHour === 12 ? 12 : normalizedHour + 12) : normalizedHour === 12 ? 0 : normalizedHour;
  return `${String(hour24).padStart(2, "0")}:${minute}`;
}

type TimePickerBottomSheetProps = {
  isOpen: boolean;
  title: string;
  initialValue: string;
  description?: string;
  cancelLabel?: string;
  applyLabel?: string;
  onClose: () => void;
  onApply: (next: string) => boolean | void;
};

export function TimePickerBottomSheet({
  isOpen,
  title,
  initialValue,
  description = "위로 스크롤해 시간을 선택해 주세요.",
  cancelLabel = "취소",
  applyLabel = "적용",
  onClose,
  onApply,
}: TimePickerBottomSheetProps) {
  const [pickerValue, setPickerValue] = useState<PickerValue>(() => toPickerValue(initialValue));

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setPickerValue(toPickerValue(initialValue));
  }, [initialValue, isOpen]);

  const mergedValue = useMemo(() => pickerValue, [pickerValue]);
  const meridiemOptions = useMemo<WheelPickerOption<(typeof MERIDIEMS)[number]>[]>(
    () =>
      MERIDIEMS.map((value) => ({
        value,
        label: <span>{value}</span>,
      })),
    []
  );
  const hourOptions = useMemo<WheelPickerOption<string>[]>(
    () =>
      HOURS_12.map((value) => ({
        value,
        label: <span>{value}</span>,
      })),
    []
  );
  const minuteOptions = useMemo<WheelPickerOption<string>[]>(
    () =>
      MINUTES.map((value) => ({
        value,
        label: <span>{value}</span>,
      })),
    []
  );

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="action-sheet-overlay time-picker-sheet-overlay" role="presentation">
      <button
        type="button"
        className="absolute inset-0 h-full w-full cursor-default bg-transparent"
        aria-label="시간 선택 닫기"
        onClick={onClose}
      />
      <section className="action-sheet-panel time-picker-sheet-panel border border-base-300 bg-base-100 text-base-content">
        <div className="px-1 pb-1">
          <p className="m-0 text-sm font-semibold">{title}</p>
          <p className="mt-0.5 mb-0 text-xs text-base-content/60">{description}</p>
        </div>

        <div className="relative mt-3 overflow-hidden rounded-xl border border-base-300/70 bg-base-100">
          <div className="pointer-events-none absolute inset-x-1 top-1/2 z-20 h-9 -translate-y-1/2 rounded-lg border border-primary/35 bg-primary/10" />
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-12 bg-gradient-to-b from-base-100 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-12 bg-gradient-to-t from-base-100 to-transparent" />

          <div className="time-picker-wheel relative z-10 px-2 py-1">
            <WheelPickerWrapper className="time-picker-wheel-grid">
              <WheelPicker
                value={mergedValue.meridiem}
                onValueChange={(next) =>
                  setPickerValue((prev) => ({ ...prev, meridiem: next as (typeof MERIDIEMS)[number] }))
                }
                options={meridiemOptions}
                infinite={false}
                visibleCount={16}
                optionItemHeight={36}
                dragSensitivity={2.2}
                scrollSensitivity={4}
                classNames={{
                  optionItem: "time-picker-wheel-option",
                  highlightWrapper: "time-picker-wheel-highlight-wrapper",
                  highlightItem: "time-picker-wheel-highlight-item",
                }}
              />
              <WheelPicker
                value={mergedValue.hour}
                onValueChange={(next) => setPickerValue((prev) => ({ ...prev, hour: String(next) }))}
                options={hourOptions}
                infinite
                visibleCount={16}
                optionItemHeight={36}
                dragSensitivity={2.2}
                scrollSensitivity={4}
                classNames={{
                  optionItem: "time-picker-wheel-option",
                  highlightWrapper: "time-picker-wheel-highlight-wrapper",
                  highlightItem: "time-picker-wheel-highlight-item",
                }}
              />
              <WheelPicker
                value={mergedValue.minute}
                onValueChange={(next) => setPickerValue((prev) => ({ ...prev, minute: String(next).padStart(2, "0") }))}
                options={minuteOptions}
                infinite
                visibleCount={16}
                optionItemHeight={36}
                dragSensitivity={2.2}
                scrollSensitivity={4}
                classNames={{
                  optionItem: "time-picker-wheel-option",
                  highlightWrapper: "time-picker-wheel-highlight-wrapper",
                  highlightItem: "time-picker-wheel-highlight-item",
                }}
              />
            </WheelPickerWrapper>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn btn-sm h-9 min-h-9 rounded-full border border-base-300 bg-base-100"
            onClick={onClose}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-sm btn-primary h-9 min-h-9 rounded-full"
            onClick={() => {
              const shouldClose = onApply(toHHmm(mergedValue));
              if (shouldClose === false) {
                return;
              }
              onClose();
            }}
          >
            {applyLabel}
          </button>
        </div>
      </section>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
