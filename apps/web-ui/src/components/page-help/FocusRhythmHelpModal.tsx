import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
import { Button } from "../ui/Button";
import { FocusRhythmHelpVisual } from "./FocusRhythmHelpVisual";

type FocusRhythmHelpModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export function FocusRhythmHelpModal({ isOpen, onClose }: FocusRhythmHelpModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const content = (
    <div className="pointer-events-auto fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="집중 리듬 안내 닫기"
        className="absolute inset-0 bg-base-300/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-rhythm-modal-title"
        className="relative z-[131] max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl border border-base-300/85 bg-base-100 p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2
            id="focus-rhythm-modal-title"
            className="m-0 text-base font-semibold text-base-content"
          >
            집중 리듬 안내
          </h2>
          <Button
            variant="ghost"
            size="xs"
            circle
            aria-label="닫기"
            onClick={onClose}
          >
            <FiX size={14} />
          </Button>
        </div>
        <FocusRhythmHelpVisual />
      </section>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
