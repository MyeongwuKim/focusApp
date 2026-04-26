import { useEffect } from "react";
import { FiX } from "react-icons/fi";
import type { PageHelpGuide } from "../config/pageHelpGuide";
import { Button } from "./ui/Button";

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
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="도움말 닫기"
        className="absolute inset-0 bg-base-300/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
      <div className="relative z-[121] w-full max-w-md rounded-2xl border border-base-300/85 bg-base-100 p-4 shadow-2xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold text-base-content">{guide.title}</h2>
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
        <p className="m-0 text-sm leading-relaxed text-base-content/78">{guide.description}</p>
        <ul className="m-0 mt-3 space-y-1.5 pl-5 text-sm leading-relaxed text-base-content/78">
          {guide.highlights.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
