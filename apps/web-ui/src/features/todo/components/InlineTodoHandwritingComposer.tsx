import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  FiCheck,
  FiChevronUp,
  FiCornerUpLeft,
  FiEdit3,
  FiRefreshCw,
  FiTrash2,
  FiType,
} from "react-icons/fi";
import { recognizeHandwriting } from "../../../api/handwritingApi";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { HandwritingCanvas, type HandwritingCanvasHandle } from "./HandwritingCanvas";

type InlineTodoHandwritingComposerProps = {
  onAdd: (label: string) => Promise<boolean>;
};

type ComposerMode = "text" | "handwriting";

/** 인식 품질을 확인할 때까지 손글씨 전환 버튼과 입력판을 숨기고 키보드 입력만 제공한다. */
const HANDWRITING_INPUT_VISIBLE = false;

/**
 * 할 일 목록 끝에서 키보드로 새 항목을 추가하며 등록 후 같은 위치에서 다음 항목을 이어서 적을 수 있다.
 * 손글씨 인식 구현은 유지하되 HANDWRITING_INPUT_VISIBLE이 true일 때만 입력 전환과 인식 결과 수정을 제공한다.
 */
export function InlineTodoHandwritingComposer({ onAdd }: InlineTodoHandwritingComposerProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const canvasRef = useRef<HandwritingCanvasHandle | null>(null);
  const recognitionRevisionRef = useRef(0);
  const [mode, setMode] = useState<ComposerMode>("text");
  const [hasDrawing, setHasDrawing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [recognitionError, setRecognitionError] = useState("");
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const isHandwritingMode = HANDWRITING_INPUT_VISIBLE && mode === "handwriting";

  const focusTextInput = () => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const clearHandwriting = () => {
    recognitionRevisionRef.current += 1;
    canvasRef.current?.clear();
    setHasDrawing(false);
    setRecognitionError("");
    setIsRecognizing(false);
  };

  /** 현재 캔버스 이미지만 인식하고, 더 나중에 시작된 요청이 있으면 이전 결과를 반영하지 않는다. */
  const recognizeCurrentDrawing = async () => {
    const imageDataUrl = canvasRef.current?.exportImage();
    if (!imageDataUrl || isRecognizing) {
      return;
    }

    const revision = recognitionRevisionRef.current;
    setIsRecognizing(true);
    setRecognitionError("");
    try {
      const text = await recognizeHandwriting(imageDataUrl);
      if (recognitionRevisionRef.current === revision) {
        setDraft(text);
      }
    } catch (error) {
      if (recognitionRevisionRef.current === revision) {
        setRecognitionError(getUserFacingErrorMessage(error, "글씨를 읽지 못했어요. 한 번 더 써주세요."));
      }
    } finally {
      if (recognitionRevisionRef.current === revision) {
        setIsRecognizing(false);
      }
    }
  };

  const handleAdd = async (event?: FormEvent) => {
    event?.preventDefault();
    const label = draft.trim();
    if (!label || isAdding || isRecognizing) {
      return;
    }

    setIsAdding(true);
    try {
      const added = await onAdd(label);
      if (!added) {
        return;
      }
      setDraft("");
      clearHandwriting();
      setMode("text");
      focusTextInput();
    } finally {
      setIsAdding(false);
    }
  };

  useEffect(() => {
    return () => {
      recognitionRevisionRef.current += 1;
    };
  }, []);

  const expandComposer = () => {
    setMode("text");
    setIsExpanded(true);
    window.requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      inputRef.current?.focus();
    });
  };

  const collapseComposer = () => {
    setDraft("");
    clearHandwriting();
    setMode("text");
    setIsExpanded(false);
  };

  return (
    <section
      ref={sectionRef}
      className="inline-todo-handwriting"
      data-expanded={isExpanded}
      data-mode={isHandwritingMode ? "handwriting" : "text"}
      data-disable-date-sheet-swipe="true"
      aria-label="할 일 바로 추가"
    >
      {!isExpanded ? (
        <button type="button" className="inline-todo-handwriting__trigger" onClick={expandComposer}>
          <span aria-hidden="true">＋</span>
          <span>새 할 일 쓰기</span>
        </button>
      ) : !isHandwritingMode ? (
        <form className="inline-todo-handwriting__text-entry" onSubmit={(event) => void handleAdd(event)}>
          <input
            ref={inputRef}
            value={draft}
            maxLength={80}
            disabled={isAdding}
            aria-label="새 할 일"
            placeholder="할 일을 입력하세요"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                collapseComposer();
              }
            }}
          />
          {HANDWRITING_INPUT_VISIBLE ? (
            <button
              type="button"
              className="inline-todo-handwriting__mode-button"
              aria-label="손글씨로 입력"
              disabled={isAdding}
              onClick={() => {
                setMode("handwriting");
                setRecognitionError("");
              }}
            >
              <FiEdit3 size={15} />
            </button>
          ) : null}
          <button
            type="submit"
            className="inline-todo-handwriting__submit"
            aria-label="할 일 추가"
            disabled={!draft.trim() || isAdding}
          >
            <FiCheck size={17} />
          </button>
          <button
            type="button"
            className="inline-todo-handwriting__collapse"
            aria-label="할 일 입력칸 접기"
            disabled={isAdding}
            onClick={collapseComposer}
          >
            <FiChevronUp size={15} />
          </button>
        </form>
      ) : (
        <>
          <div className="inline-todo-handwriting__toolbar">
            <p>한 줄로 쓰고 ‘글씨 읽기’를 눌러주세요</p>
            <div>
              <button
                type="button"
                aria-label="키보드로 입력"
                disabled={isRecognizing || isAdding}
                onClick={() => {
                  setMode("text");
                  focusTextInput();
                }}
              >
                <FiType size={14} />
              </button>
              <button
                type="button"
                aria-label="마지막 획 되돌리기"
                disabled={!hasDrawing || isRecognizing || isAdding}
                onClick={() => {
                  recognitionRevisionRef.current += 1;
                  canvasRef.current?.undo();
                  setDraft("");
                  setRecognitionError("");
                }}
              >
                <FiCornerUpLeft size={14} />
              </button>
              <button
                type="button"
                aria-label="손글씨 지우기"
                disabled={!hasDrawing || isRecognizing || isAdding}
                onClick={() => {
                  setDraft("");
                  clearHandwriting();
                }}
              >
                <FiTrash2 size={14} />
              </button>
              <button
                type="button"
                aria-label="손글씨 입력칸 접기"
                disabled={isRecognizing || isAdding}
                onClick={collapseComposer}
              >
                <FiChevronUp size={15} />
              </button>
            </div>
          </div>

          <HandwritingCanvas
            ref={canvasRef}
            className="inline-todo-handwriting__canvas"
            onDrawingChange={(nextHasDrawing) => {
              recognitionRevisionRef.current += 1;
              setHasDrawing(nextHasDrawing);
              setDraft("");
              setRecognitionError("");
            }}
          />

          <div className="inline-todo-handwriting__recognize-row">
            {recognitionError ? <span role="status">{recognitionError}</span> : <span />}
            <button
              type="button"
              disabled={!hasDrawing || isRecognizing || isAdding}
              onClick={() => void recognizeCurrentDrawing()}
            >
              <FiRefreshCw size={13} />
              {isRecognizing ? "읽는 중" : "글씨 읽기"}
            </button>
          </div>

          {isRecognizing || draft ? (
            <form className="inline-todo-handwriting__result" onSubmit={(event) => void handleAdd(event)}>
              <input
                ref={inputRef}
                value={draft}
                maxLength={80}
                disabled={isRecognizing || isAdding}
                aria-label="인식된 할 일"
                placeholder={isRecognizing ? "글씨 읽는 중..." : "인식된 할 일"}
                onChange={(event) => setDraft(event.target.value)}
              />
              <button
                type="submit"
                aria-label="인식된 할 일 추가"
                disabled={!draft.trim() || isRecognizing || isAdding}
              >
                <FiCheck size={17} />
              </button>
            </form>
          ) : null}
        </>
      )}
    </section>
  );
}
