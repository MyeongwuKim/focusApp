import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

type CreateCollectionModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string) => void;
};

export function CreateCollectionModal({ isOpen, onClose, onCreate }: CreateCollectionModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [name, setName] = useState("");

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      return;
    }
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setName("");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

  if (!shouldRender) {
    return null;
  }

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
          <h3 className="m-0 text-base font-semibold text-base-content">컬렉션 추가</h3>
          <Button variant="ghost" size="xs" circle onClick={onClose} aria-label="컬렉션 추가 닫기">
            <FiX size={14} />
          </Button>
        </div>

        <div className="space-y-3">
          <InputField
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                const nextName = name.trim();
                if (!nextName) {
                  return;
                }
                onCreate(nextName);
                onClose();
              }
            }}
            className="w-full"
            placeholder="컬렉션 이름"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              취소
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={name.trim().length === 0}
              onClick={() => {
                const nextName = name.trim();
                if (!nextName) {
                  return;
                }
                onCreate(nextName);
                onClose();
              }}
            >
              생성
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
