import { useEffect } from "react";
import { createPortal } from "react-dom";
import { FiX } from "react-icons/fi";
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
    <div className="page-help-overlay pointer-events-auto fixed inset-0 z-[130] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="집중 리듬 안내 닫기"
        className="page-help-backdrop absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="focus-rhythm-modal-title"
        className="page-help-note sketchbook-floating-surface relative z-[131] w-full max-w-md border border-base-300/85 shadow-2xl"
      >
        <span className="page-help-note__tape" aria-hidden="true" />
        <header className="page-help-note__header">
          <div className="page-help-note__heading">
            <span className="page-help-note__question" aria-hidden="true">?</span>
            <div>
              <p className="page-help-note__eyebrow">페이지 사용법</p>
              <h2 id="focus-rhythm-modal-title">집중 리듬 안내</h2>
            </div>
          </div>
          <button type="button" className="page-help-note__close" aria-label="닫기" onClick={onClose}>
            <FiX size={14} />
          </button>
        </header>
        <div className="page-help-note__body page-help-note__body--visual">
          <FocusRhythmHelpVisual />
        </div>
      </section>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(content, document.body) : content;
}
