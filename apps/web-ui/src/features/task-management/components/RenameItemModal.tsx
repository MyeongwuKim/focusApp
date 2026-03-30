import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";

type RenameItemModalProps = {
  isOpen: boolean;
  title: string;
  initialValue: string;
  placeholder: string;
  onClose: () => void;
  onRename: (nextName: string) => void;
};

export function RenameItemModal({
  isOpen,
  title,
  initialValue,
  placeholder,
  onClose,
  onRename,
}: RenameItemModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [name, setName] = useState(initialValue);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setName(initialValue);
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldRender(false);
    }, 180);
    return () => window.clearTimeout(timer);
  }, [initialValue, isOpen]);

  if (!shouldRender) {
    return null;
  }

  const disabled = name.trim().length === 0;

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
          <h3 className="m-0 text-base font-semibold text-base-content">{title}</h3>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            onClick={onClose}
            aria-label="이름 변경 닫기"
          >
            <FiX size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (disabled) {
                  return;
                }
                onRename(name.trim());
                onClose();
              }
            }}
            className="input input-bordered w-full focus:outline-none focus:ring-0 focus:border-base-300"
            placeholder={placeholder}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
              취소
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={disabled}
              onClick={() => {
                if (disabled) {
                  return;
                }
                onRename(name.trim());
                onClose();
              }}
            >
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
