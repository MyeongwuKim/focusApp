import { useRef } from "react";
import { FiChevronUp } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { useAppStore } from "../../../stores";

type FooterBarProps = {
  onGoToday: () => void;
  onOpenDateSheet: () => void;
};

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

type TouchPoint = {
  x: number;
  y: number;
};

export function FooterBar({ onGoToday, onOpenDateSheet }: FooterBarProps) {
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const selectedDateLabel = selectedDateKey ? formatSelectedDate(selectedDateKey) : "날짜를 선택해 주세요";
  const touchStartRef = useRef<TouchPoint | null>(null);

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaY = touch.clientY - start.y;
    const deltaX = touch.clientX - start.x;
    const shouldOpenBySwipe = deltaY < -36 && Math.abs(deltaX) < 72;
    if (shouldOpenBySwipe) {
      onOpenDateSheet();
    }
  };

  return (
    <footer
      className="mt-0 shrink-0 border-t border-base-300/70 bg-base-200/75 px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="mb-1 flex items-center justify-center text-base-content/45">
        <FiChevronUp size={16} />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="min-w-0 flex-1 rounded-lg px-1 py-1 text-left transition-colors hover:bg-base-100/40"
          onClick={onOpenDateSheet}
        >
          <p className="m-0 text-[11px] font-semibold tracking-wide text-base-content/45">선택 날짜</p>
          <p className="m-0 truncate text-sm font-medium text-base-content/85">{selectedDateLabel}</p>
        </button>
        <Button
          className="h-11 min-h-11 rounded-full border-base-300 bg-base-100 px-7 text-base text-base-content shadow-sm"
          onClick={onGoToday}
        >
          오늘
        </Button>
      </div>
    </footer>
  );
}
