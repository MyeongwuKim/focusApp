import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

type TodoTargetFocusModalProps = {
  isOpen: boolean;
  initialMinutes: number;
  onClose: () => void;
  onSave: (minutes: number | null) => void;
};

export function TodoTargetFocusModal({
  isOpen,
  initialMinutes,
  onClose,
  onSave,
}: TodoTargetFocusModalProps) {
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
  const disabled = !Number.isFinite(parsedMinutes) || parsedMinutes < 1;

  return (
    <div
      className={[
        "absolute inset-0 z-40 flex items-center justify-center bg-transparent p-4 transition-opacity duration-200",
        isOpen ? "opacity-100" : "opacity-0",
      ].join(" ")}
      onClick={onClose}
    >
      <div
        className={[
          "w-full max-w-sm rounded-2xl border border-base-300/80 bg-base-100 p-4 transition-transform duration-200",
          isOpen ? "translate-y-0" : "translate-y-2",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="m-0 text-base font-semibold text-base-content">목표 집중시간 설정</h3>
          <Button variant="ghost" size="xs" circle onClick={onClose} aria-label="목표 집중시간 설정 닫기">
            <FiX size={14} />
          </Button>
        </div>

        <div className="space-y-3">
          <InputField
            type="number"
            min={1}
            step={1}
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
            className="w-full"
            placeholder="목표 집중시간(최소 1분)"
          />
          <p className="m-0 text-xs text-base-content/60">최소 1분부터 설정할 수 있어요.</p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onSave(null)}>
              해제
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                onSave(Math.floor(parsedMinutes));
              }}
            >
              저장
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
