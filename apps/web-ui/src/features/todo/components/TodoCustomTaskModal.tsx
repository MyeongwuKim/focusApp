import { useEffect, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { SelectDropbox } from "../../../components/SelectDropbox";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";

export type TodoCustomAddMode = "today_only" | "save_collection";

type TodoCustomTaskCollection = {
  id: string;
  name: string;
};

type TodoCustomTaskModalProps = {
  isOpen: boolean;
  isSubmitting: boolean;
  collections: TodoCustomTaskCollection[];
  defaultCollectionId?: string;
  onClose: () => void;
  onSubmit: (input: {
    label: string;
    mode: TodoCustomAddMode;
    collectionId?: string;
  }) => Promise<boolean>;
};

export function TodoCustomTaskModal({
  isOpen,
  isSubmitting,
  collections,
  defaultCollectionId,
  onClose,
  onSubmit,
}: TodoCustomTaskModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<TodoCustomAddMode>("today_only");
  const [collectionId, setCollectionId] = useState("");
  const isComposingRef = useRef(false);
  const submitLockRef = useRef(false);
  const firstCollectionId = collections[0]?.id ?? "";
  const initialCollectionId =
    defaultCollectionId && collections.some((collection) => collection.id === defaultCollectionId)
      ? defaultCollectionId
      : firstCollectionId;

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setMode("today_only");
      setCollectionId(initialCollectionId);
      return;
    }

    const timer = window.setTimeout(() => {
      setShouldRender(false);
      setLabel("");
    }, 180);
    return () => window.clearTimeout(timer);
  }, [initialCollectionId, isOpen]);

  useEffect(() => {
    if (!collectionId || collections.some((collection) => collection.id === collectionId)) {
      return;
    }
    setCollectionId(firstCollectionId);
  }, [collectionId, collections, firstCollectionId]);

  if (!shouldRender) {
    return null;
  }

  const disabled =
    label.trim().length === 0 ||
    isSubmitting ||
    (mode === "save_collection" && collectionId.length === 0);
  const handleClose = () => {
    if (isSubmitting || submitLockRef.current) {
      return;
    }
    onClose();
  };
  const handleSubmit = async () => {
    const nextLabel = label.trim();
    if (!nextLabel || isSubmitting || submitLockRef.current) {
      return;
    }

    submitLockRef.current = true;
    try {
      const added = await onSubmit({
        label: nextLabel,
        mode,
        ...(mode === "save_collection" ? { collectionId } : {}),
      });
      if (added) {
        onClose();
      }
    } finally {
      submitLockRef.current = false;
    }
  };

  return (
    <div
      className={[
        "absolute inset-0 z-50 flex items-center justify-center bg-transparent p-4 transition-opacity duration-200",
        isOpen ? "opacity-100" : "pointer-events-none opacity-0",
      ].join(" ")}
      onClick={handleClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="todo-custom-task-modal-title"
        className={[
          "w-full max-w-sm rounded-2xl border border-base-300/80 bg-base-100 p-4 transition-transform duration-200",
          isOpen ? "translate-y-0" : "translate-y-2",
        ].join(" ")}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 id="todo-custom-task-modal-title" className="m-0 text-base font-semibold text-base-content">
            새 할일 입력
          </h3>
          <Button
            variant="ghost"
            size="xs"
            circle
            disabled={isSubmitting}
            onClick={handleClose}
            aria-label="새 할일 입력 닫기"
          >
            <FiX size={14} />
          </Button>
        </div>

        <div className="space-y-3">
          <div>
            <p className="mb-1.5 mt-0 text-xs font-semibold text-base-content/70">사용 방식</p>
            <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] items-center gap-2">
              <div className="grid h-10 grid-cols-2 rounded-xl bg-base-200 p-1">
                <Button
                  variant={mode === "today_only" ? "primary" : "ghost"}
                  disabled={isSubmitting}
                  className="h-8 min-h-8 rounded-lg px-2 text-[11px]"
                  aria-pressed={mode === "today_only"}
                  onClick={() => setMode("today_only")}
                >
                  오늘만 사용
                </Button>
                <Button
                  variant={mode === "save_collection" ? "primary" : "ghost"}
                  disabled={isSubmitting}
                  className="h-8 min-h-8 rounded-lg px-2 text-[11px]"
                  aria-pressed={mode === "save_collection"}
                  onClick={() => setMode("save_collection")}
                >
                  컬렉션 저장
                </Button>
              </div>

              <SelectDropbox
                value={mode === "save_collection" ? collectionId : null}
                onValueChange={setCollectionId}
                options={collections.map((collection) => ({
                  value: collection.id,
                  label: collection.name,
                }))}
                className="rounded-xl"
                disabled={isSubmitting || mode !== "save_collection" || collections.length === 0}
                placeholder={collections.length > 0 ? "컬렉션 선택" : "컬렉션 없음"}
              />
            </div>
          </div>

          <InputField
            autoFocus
            value={label}
            disabled={isSubmitting}
            onChange={(event) => setLabel(event.target.value)}
            onCompositionStart={() => {
              isComposingRef.current = true;
            }}
            onCompositionEnd={() => {
              isComposingRef.current = false;
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || isComposingRef.current || event.nativeEvent.isComposing) {
                return;
              }
              event.preventDefault();
              void handleSubmit();
            }}
            className="w-full"
            placeholder="추가할 할일"
          />

          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" disabled={isSubmitting} onClick={handleClose}>
              취소
            </Button>
            <Button variant="primary" size="sm" disabled={disabled} onClick={() => void handleSubmit()}>
              {isSubmitting ? "담는 중..." : "선택 목록에 담기"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
