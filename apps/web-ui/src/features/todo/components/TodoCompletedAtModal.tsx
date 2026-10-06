import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

type TodoCompletedAtModalProps = {
  isOpen: boolean;
  initialMinutes: number;
  mode: "completion" | "edit";
  onClose: () => void;
  onSave: (minutes: number) => void;
};

export function TodoCompletedAtModal({
  isOpen,
  initialMinutes,
  mode,
  onClose,
  onSave,
}: TodoCompletedAtModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [minutes, setMinutes] = useState(String(initialMinutes));

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setMinutes(String(initialMinutes));
      return;
    }
    const timer = window.setTimeout(() => {
      setShouldRender(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [initialMinutes, isOpen]);

  if (!shouldRender) {
    return null;
  }

  const parsedMinutes = Number(minutes);
  const disabled = !Number.isFinite(parsedMinutes) || parsedMinutes < 0;

  return (
    <div
      className={[
        "todo-focus-sheet-overlay absolute inset-0 z-40 flex items-end justify-center transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "todo-focus-sheet w-full max-w-sm transition-transform duration-200",
          isOpen ? "translate-y-0" : "translate-y-2",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="todo-focus-sheet__header mb-3 flex items-center justify-between">
          <h3 className="todo-focus-sheet__title m-0 text-base font-semibold">
            {mode === "completion" ? "집중 시간 기록" : "집중 시간 변경"}
          </h3>
          <Button
            variant="ghost"
            size="xs"
            circle
            className="todo-focus-sheet__close"
            onClick={onClose}
            aria-label="집중 시간 입력 닫기"
          >
            <FiX size={14} />
          </Button>
        </div>

        <div className="todo-focus-sheet__body space-y-3">
          <InputField
            type="number"
            min={0}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (disabled) {
                  return;
                }
                onSave(Math.floor(parsedMinutes));
              }
            }}
            className="todo-focus-sheet__input w-full"
            placeholder="집중 시간(분)"
          />
          <div className="todo-focus-sheet__actions flex justify-end gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="todo-focus-sheet__button"
              data-tone="neutral"
              onClick={onClose}
            >
              {mode === "completion" ? "건너뛰기" : "취소"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              className="todo-focus-sheet__button"
              data-tone="primary"
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                onSave(Math.floor(parsedMinutes));
              }}
            >
              {mode === "completion" ? "기록" : "저장"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
