import { useEffect, useRef, useState } from "react";
import { FiCheckCircle, FiChevronRight, FiChevronUp, FiClipboard } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { useHorizontalSwipeGesture } from "../../../hooks/useHorizontalSwipeGesture";
import { useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";
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

function getEmptyMessageByDate(selectedDateKey: string) {
  const todayDateKey = formatDateKey(new Date());
  if (selectedDateKey === todayDateKey) {
    return {
      title: "오늘 할 일이 아직 없어요.",
      description: "할 일을 추가해서 하루를 시작해볼까요?",
    };
  }
  if (selectedDateKey < todayDateKey) {
    return {
      title: "이 날짜에는 기록된 할 일이 없어요.",
      description: "필요하면 회고 메모만 남겨도 좋아요.",
    };
  }
  return {
    title: "이 날짜에는 예정된 할 일이 없어요.",
    description: "미리 할 일을 등록해두면 관리가 쉬워져요.",
  };
}

export function DateSelectionSheet({
  isOpen,
  selectedTasks,
  onRequestClose,
  onRequestOpenTasks,
  onShiftSelectedDate,
}: DateSelectionSheetProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const emptyMessage = selectedDateKey
    ? getEmptyMessageByDate(selectedDateKey)
    : { title: "", description: "" };
  const handleTouchStartYRef = useRef<number | null>(null);
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [motion, setMotion] = useState<"enter" | "leave">("enter");
  const [isDragging, setIsDragging] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [bodyDragX, setBodyDragX] = useState(0);
  const {
    handleTouchStart: handleBodySwipeTouchStart,
    handleTouchMove: handleBodySwipeTouchMove,
    handleTouchEnd: handleBodySwipeTouchEnd,
    handleTouchCancel: handleBodySwipeTouchCancel,
  } = useHorizontalSwipeGesture({
    onStart: () => {
      setIsDragging(true);
    },
    onHorizontalMove: ({ deltaX }) => {
      setBodyDragX(deltaX);
    },
    onEnd: ({ axis, deltaX }) => {
      const swipeThreshold = 52;

      if (axis === "horizontal" && Math.abs(deltaX) > swipeThreshold) {
        onShiftSelectedDate(deltaX < 0 ? 1 : -1);
      }

      setBodyDragX(0);
      setIsDragging(false);
    },
    onCancel: () => {
      setIsDragging(false);
      setBodyDragX(0);
    },
  });

  useEffect(() => {
    if (isOpen) {
      setShouldRender(true);
      setMotion("enter");
      setDragY(0);
      setBodyDragX(0);
      setIsDragging(false);
      return;
    }

    if (shouldRender) {
      setMotion("leave");
      setIsDragging(false);
      setDragY(0);
      setBodyDragX(0);
    }
  }, [isOpen, shouldRender]);

  if (!shouldRender || !selectedDateKey) {
    return null;
  }

  const handleHandleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    handleTouchStartYRef.current = touch.clientY;
    setIsDragging(true);
  };

  const handleHandleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const startY = handleTouchStartYRef.current;
    if (startY === null) {
      return;
    }

    const touch = event.touches[0];
    const deltaY = Math.max(touch.clientY - startY, 0);
    event.preventDefault();
    setDragY(deltaY);
  };

  const handleHandleTouchEnd: React.TouchEventHandler<HTMLDivElement> = () => {
    const closeThreshold = 84;

    if (dragY > closeThreshold) {
      onRequestClose();
    } else {
      setDragY(0);
    }

    handleTouchStartYRef.current = null;
    setIsDragging(false);
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
          transform: motion === "leave" ? "translateY(112%)" : `translateY(${dragY}px)`,
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
          onTouchStart={handleHandleTouchStart}
          onTouchMove={handleHandleTouchMove}
          onTouchEnd={handleHandleTouchEnd}
          onTouchCancel={() => {
            setIsDragging(false);
            setDragY(0);
            handleTouchStartYRef.current = null;
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
          <Button
            size="xs"
            className="h-7 min-h-7 rounded-full border-base-300 bg-base-100 px-2 text-[11px] text-base-content/80"
            onClick={onRequestOpenTasks}
          >
            상세
            <FiChevronRight size={12} />
          </Button>
        </div>
        <div
          className="mt-2 flex-1 overflow-hidden"
          onTouchStart={handleBodySwipeTouchStart}
          onTouchMove={handleBodySwipeTouchMove}
          onTouchEnd={handleBodySwipeTouchEnd}
          onTouchCancel={handleBodySwipeTouchCancel}
        >
          <div
            className="h-full space-y-2 overflow-y-auto overscroll-contain"
            style={{
              transform: `translateX(${bodyDragX}px)`,
              transition: isDragging ? "none" : "transform 180ms ease-out",
            }}
          >
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
                  {emptyMessage.title}
                </p>
                <p className="m-0 text-sm text-base-content/60">{emptyMessage.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
