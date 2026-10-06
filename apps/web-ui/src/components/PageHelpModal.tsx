import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import type { PageHelpGuide } from "../config/pageHelpGuide";

type PageHelpModalProps = {
  isOpen: boolean;
  guide: PageHelpGuide | null;
  onClose: () => void;
};

export function PageHelpModal({ isOpen, guide, onClose }: PageHelpModalProps) {
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

  if (!isOpen || !guide) {
    return null;
  }

  return (
    <div className="page-help-overlay pointer-events-auto fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="도움말 닫기"
        className="page-help-backdrop absolute inset-0"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="page-help-modal-title"
        className="page-help-note sketchbook-floating-surface relative z-[121] w-full max-w-md border border-base-300/85 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <span className="page-help-note__tape" aria-hidden="true" />
        <header className="page-help-note__header">
          <div className="page-help-note__heading">
            <span className="page-help-note__question" aria-hidden="true">?</span>
            <div>
              <p className="page-help-note__eyebrow">페이지 사용법</p>
              <h2 id="page-help-modal-title">{guide.title}</h2>
            </div>
          </div>
          <button type="button" className="page-help-note__close" aria-label="닫기" onClick={onClose}>
            <FiX size={14} />
          </button>
        </header>
        <div className="page-help-note__body">
          <p className="page-help-note__description">{guide.description}</p>
          <ul className="page-help-note__list">
            {guide.highlights.map((line) => (
              <li key={line}><span>{line}</span></li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
