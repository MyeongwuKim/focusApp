import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiChevronRight, FiChevronUp, FiClipboard } from "react-icons/fi";
import { useAppStore } from "../../../stores";
import { formatDateLabel } from "../utils/date";

type SelectedTaskItem = {
  label: string;
  done: boolean;
};

type DateSelectionSheetProps = {
  isOpen: boolean;
  selectedTasks: SelectedTaskItem[];
  onRequestClose: () => void;
  onRequestOpenTasks: () => void;
  onShiftSelectedDate: (days: number) => void;
};

type TouchPoint = {
  x: number;
  y: number;
};

type SwipeAxis = "horizontal" | "vertical" | null;

export function DateSelectionSheet({
  isOpen,
  selectedTasks,
  onRequestClose,
  onRequestOpenTasks,
  onShiftSelectedDate,
}: DateSelectionSheetProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [motion, setMotion] = useState<"enter" | "leave">("enter");
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const [dragY, setDragY] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setMotion("enter");
      setDragX(0);
      setDragY(0);
      setIsDragging(false);
      return;
    }

    if (shouldRender) {
      setMotion("leave");
      setIsDragging(false);
      setDragX(0);
      setDragY(0);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender || !selectedDateKey) {
    return null;
  }

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    swipeAxisRef.current = null;
    setIsDragging(true);
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    if (!start) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!swipeAxisRef.current) {
      const axisThreshold = 8;
      if (Math.abs(deltaX) < axisThreshold && Math.abs(deltaY) < axisThreshold) {
        return;
      }
      swipeAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (swipeAxisRef.current === "horizontal") {
      event.preventDefault();
      setDragX(deltaX);
      setDragY(0);
      return;
    }

    event.preventDefault();
    setDragY(deltaY);
    setDragX(0);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const closeThreshold = 84;
    const swipeThreshold = 52;

    setIsDragging(false);

    if (swipeAxisRef.current === "horizontal") {
      if (Math.abs(dragX) > swipeThreshold) {
        onShiftSelectedDate(dragX < 0 ? 1 : -1);
      }
      setDragX(0);
      setDragY(0);
      touchStartRef.current = null;
      swipeAxisRef.current = null;
      return;
    }

    if (dragY > closeThreshold) {
      onRequestClose();
    } else {
      setDragY(0);
      setDragX(0);
    }

    touchStartRef.current = null;
    swipeAxisRef.current = null;
  };

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30"
      style={{ bottom: "calc(-5.5rem - env(safe-area-inset-bottom))" }}
    >
      <div
        className={[
          "pointer-events-auto flex h-72 flex-col rounded-t-2xl border border-base-300 bg-base-100 p-4 shadow-[0_-18px_45px_rgba(15,23,42,0.28)]",
          motion === "enter" && !isDragging ? "date-sheet-enter" : "",
        ].join(" ")}
        style={{
          transform: motion === "leave" ? "translateY(112%)" : `translate(${dragX}px, ${dragY}px)`,
          opacity: motion === "leave" ? 0 : 1,
          transition: isDragging
            ? "none"
            : "transform 220ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease",
        }}
        onTransitionEnd={(event) => {
          if (event.currentTarget !== event.target) {
            return;
          }
          if (motion === "leave") {
            setShouldRender(false);
          }
        }}
      >
        <div
          className="mb-1 select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={() => {
            setIsDragging(false);
            setDragX(0);
            setDragY(0);
            touchStartRef.current = null;
            swipeAxisRef.current = null;
          }}
        >
          <div className="flex items-center justify-center text-base-content/45">
            <FiChevronUp size={18} />
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <p className="m-0 text-[0.95rem] font-semibold text-base-content">
            {formatDateLabel(selectedDateKey)}
          </p>
          <button
            type="button"
            className="btn btn-xs h-7 min-h-7 rounded-full border-base-300 bg-base-100 px-2 text-[11px] text-base-content/80"
            onClick={onRequestOpenTasks}
          >
            상세
            <FiChevronRight size={12} />
          </button>
        </div>
        <div className="mt-2 flex-1 space-y-2 overflow-y-auto overscroll-contain">
          {selectedTasks.length > 0 ? (
            selectedTasks.map((task, index) => (
              <div
                key={`${selectedDateKey}-${task.label}-${index}`}
                className="flex items-center gap-2 rounded-lg border border-base-300/80 bg-base-200/50 px-2.5 py-2 text-sm text-base-content/85"
              >
                {task.done ? <FiCheckCircle size={14} className="text-success" /> : null}
                <span className={task.done ? "truncate text-base-content/55 line-through" : "truncate"}>
                  {task.label}
                </span>
              </div>
            ))
          ) : (
            <div className="flex min-h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
                <FiClipboard size={20} />
              </span>
              <p className="m-0 text-base font-semibold tracking-tight text-base-content/80">
                지금은 비어 있어요. 작은 할 일부터 시작해볼까요?
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
