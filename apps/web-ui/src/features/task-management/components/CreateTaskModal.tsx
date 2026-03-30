import { useEffect, useMemo, useState } from "react";
import { FiX } from "react-icons/fi";
import type { ManagedCollection } from "./TaskManagementBody";

type CreateTaskModalProps = {
  isOpen: boolean;
  collections: ManagedCollection[];
  onClose: () => void;
  onCreate: (input: { label: string; collectionId: string }) => void;
};

export function CreateTaskModal({ isOpen, collections, onClose, onCreate }: CreateTaskModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [label, setLabel] = useState("");
  const [collectionId, setCollectionId] = useState("");

  const firstCollectionId = useMemo(() => collections[0]?.id ?? "", [collections]);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setCollectionId((prev) => prev || firstCollectionId);
      return;
    }
    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setLabel("");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [firstCollectionId, isOpen]);

  useEffect(() => {
    if (!collections.find((collection) => collection.id === collectionId)) {
      setCollectionId(firstCollectionId);
    }
  }, [collectionId, collections, firstCollectionId]);

  if (!shouldRender) {
    return null;
  }

  const disabled = label.trim().length === 0 || collectionId.length === 0;

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
          <h3 className="m-0 text-base font-semibold text-base-content">할일 추가</h3>
          <button
            type="button"
            className="btn btn-ghost btn-xs btn-circle"
            onClick={onClose}
            aria-label="할일 추가 닫기"
          >
            <FiX size={14} />
          </button>
        </div>

        <div className="space-y-3">
          <select
            className="select select-bordered w-full focus:outline-none focus:ring-0 focus:border-base-300"
            value={collectionId}
            onChange={(event) => setCollectionId(event.target.value)}
          >
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.name}
              </option>
            ))}
          </select>
          <input
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (disabled) {
                  return;
                }
                onCreate({ label: label.trim(), collectionId });
                onClose();
              }
            }}
            className="input input-bordered w-full focus:outline-none focus:ring-0 focus:border-base-300"
            placeholder="추가할 할일"
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
                onCreate({ label: label.trim(), collectionId });
                onClose();
              }}
            >
              추가
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
