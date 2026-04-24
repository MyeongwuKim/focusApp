import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { DateTodosMemoStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosMemoStandaloneLayer";
import { DateTodosRoutineStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosRoutineStandaloneLayer";
import { DateTodosTaskPickerStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosTaskPickerStandaloneLayer";
import { DateTodosRoutePage } from "../../../pages/DateTodosRoutePage";
import { useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";

type DateTasksBottomSheetProps = {
  isVisible: boolean;
  isExpanded: boolean;
  restFinishedRequested?: boolean;
  onExpandedChange: (isExpanded: boolean) => void;
};

const EXPAND_THRESHOLD_PX = 88;
const COLLAPSE_THRESHOLD_PX = 132;

function getViewportHeight() {
  if (typeof window === "undefined") {
    return 844;
  }
  return window.innerHeight || 844;
}

function applyDragResistance(delta: number) {
  if (delta === 0) {
    return 0;
  }
  const sign = delta > 0 ? 1 : -1;
  return sign * Math.sqrt(Math.abs(delta)) * 3.2;
}

function formatSelectedDate(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(year, month - 1, day));
}

export function DateTasksBottomSheet({
  isVisible,
  isExpanded,
  restFinishedRequested = false,
  onExpandedChange,
}: DateTasksBottomSheetProps) {
  type LocalOverlayLayer = "routine-import" | "routine-create" | "task-picker" | "memo" | null;
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const [sheetContainerHeight, setSheetContainerHeight] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
  const [localOverlayLayer, setLocalOverlayLayer] = useState<LocalOverlayLayer>(null);
  const [barHeight, setBarHeight] = useState(94);
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);
  const headerTouchStartYRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);

  const resolvedDateKey = selectedDateKey ?? formatDateKey(new Date());
  const forcedSearch = useMemo(() => {
    const params = new URLSearchParams({
      date: resolvedDateKey,
    });
    if (restFinishedRequested) {
      params.set("restFinished", "1");
    }
    return `?${params.toString()}`;
  }, [resolvedDateKey, restFinishedRequested]);
  const selectedDateLabel = formatSelectedDate(resolvedDateKey);
  const todayDateKey = formatDateKey(new Date());
  const canGoToday = resolvedDateKey !== todayDateKey;
  const isLocalRoutineOverlayOpen = localOverlayLayer !== null;
  const effectiveContainerHeight = sheetContainerHeight > 0 ? sheetContainerHeight : viewportHeight;
  const collapsedOffset = Math.max(0, effectiveContainerHeight - barHeight);

  const baseOffset = isExpanded ? 0 : collapsedOffset;
  const translateY = Math.min(collapsedOffset, Math.max(0, baseOffset + dragY));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handleResize = () => {
      setViewportHeight(getViewportHeight());
      const nextHeight = Math.round(sheetContainerRef.current?.getBoundingClientRect().height ?? 0);
      if (Number.isFinite(nextHeight) && nextHeight > 0) {
        setSheetContainerHeight(nextHeight);
      }
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && sheetContainerRef.current
        ? new ResizeObserver(() => {
            const nextHeight = Math.round(sheetContainerRef.current?.getBoundingClientRect().height ?? 0);
            if (Number.isFinite(nextHeight) && nextHeight > 0) {
              setSheetContainerHeight(nextHeight);
            }
          })
        : null;
    if (resizeObserver && sheetContainerRef.current) {
      resizeObserver.observe(sheetContainerRef.current);
    }

    const visualViewport = window.visualViewport;
    window.addEventListener("resize", handleResize);
    visualViewport?.addEventListener("resize", handleResize);

    handleResize();

    return () => {
      window.removeEventListener("resize", handleResize);
      visualViewport?.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const nextBarHeight = Math.round(barRef.current?.getBoundingClientRect().height ?? 94);
    if (Number.isFinite(nextBarHeight) && nextBarHeight > 0) {
      setBarHeight(nextBarHeight);
    }
  }, [isExpanded, isVisible, selectedDateLabel]);

  useEffect(() => {
    if (!isVisible) {
      setDragY(0);
      setIsHeaderDragging(false);
      setLocalOverlayLayer(null);
      headerTouchStartYRef.current = null;
    }
  }, [isVisible]);

  if (!isVisible) {
    return null;
  }

  const handleHeaderTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const touch = event.touches[0];
    headerTouchStartYRef.current = touch.clientY;
    setIsHeaderDragging(true);
  };

  const handleHeaderTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    const startY = headerTouchStartYRef.current;
    if (startY === null) {
      return;
    }

    const touch = event.touches[0];
    const rawDeltaY = touch.clientY - startY;
    event.preventDefault();

    if (!isExpanded) {
      if (rawDeltaY <= 0) {
        setDragY(Math.max(-collapsedOffset, rawDeltaY));
        return;
      }
      // 접힌 상태에서는 아래로 더 밀려 화면 밖으로 벗어나지 않도록 고정
      setDragY(0);
      return;
    }

    if (rawDeltaY >= 0) {
      setDragY(Math.min(rawDeltaY, collapsedOffset));
      return;
    }

    setDragY(applyDragResistance(rawDeltaY));
  };

  const handleHeaderTouchEnd = () => {
    const currentDragY = dragY;
    setIsHeaderDragging(false);
    headerTouchStartYRef.current = null;
    setDragY(0);

    if (!isExpanded) {
      onExpandedChange(Math.max(0, -currentDragY) >= EXPAND_THRESHOLD_PX);
      return;
    }

    onExpandedChange(!(currentDragY >= COLLAPSE_THRESHOLD_PX));
  };

  const handleGoToday = () => {
    const now = new Date();
    const nextDateKey = formatDateKey(now);
    setSelectedDateKey(nextDateKey);
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleShiftDateKeyInSheet = (nextDateKey: string) => {
    setSelectedDateKey(nextDateKey);
    const [year, month] = nextDateKey.split("-").map(Number);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return;
    }
    setViewMonth(new Date(year, month - 1, 1));
  };

  return (
    <div ref={sheetContainerRef} className="pointer-events-none absolute inset-0 z-30">
      <section
        className={[
          "pointer-events-auto absolute inset-x-0 top-0 bottom-0 flex flex-col border border-base-300 bg-base-100/98 shadow-[0_-14px_40px_rgba(15,23,42,0.24)]",
          isExpanded && !isHeaderDragging ? "rounded-none" : "rounded-t-2xl",
        ].join(" ")}
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isHeaderDragging ? "none" : "transform 260ms cubic-bezier(0.22,1,0.36,1), border-radius 200ms ease",
          willChange: "transform",
        }}
        data-disable-overlay-swipe-back="true"
      >
        <div
          ref={barRef}
          className={[
            "touch-pan-y transition-opacity duration-150",
            isLocalRoutineOverlayOpen ? "shrink-0 pointer-events-none opacity-100" : "shrink-0 opacity-100",
          ].join(" ")}
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          onTouchCancel={handleHeaderTouchEnd}
          aria-hidden={false}
        >
          <div className="border-t border-base-300/70 bg-base-200/75 px-2.5 py-2">
            <div className="grid min-h-10 grid-cols-[3.75rem_minmax(0,1fr)_3.75rem] items-center gap-1">
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base-content/45 transition-colors hover:bg-base-100/45"
                onClick={() => onExpandedChange(!isExpanded)}
                aria-label={isExpanded ? "오늘할일 접기" : "오늘할일 펼치기"}
                tabIndex={0}
              >
                {isExpanded ? <FiChevronDown size={16} /> : <FiChevronUp size={16} />}
              </button>
              <button
                type="button"
                className="min-w-0 rounded-lg px-2 py-1 text-center text-[15px] font-semibold tracking-tight text-base-content/90 transition-colors hover:bg-base-100/40"
                onClick={() => onExpandedChange(true)}
                tabIndex={0}
              >
                <span className="inline-flex max-w-full items-center justify-center gap-1.5">
                  <span className="truncate">{selectedDateLabel}</span>
                  <span
                    className={[
                      "shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                      canGoToday
                        ? "pointer-events-none invisible border-transparent text-transparent"
                        : "border-primary/30 bg-primary/10 text-primary",
                    ].join(" ")}
                  >
                    오늘
                  </span>
                </span>
              </button>
              {canGoToday ? (
                <Button
                  className="h-8 min-h-8 border-base-300 bg-base-100 px-3 text-xs font-semibold text-base-content shadow-sm"
                  onClick={handleGoToday}
                  tabIndex={0}
                >
                  오늘
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DateTodosRoutePage
            forcedPathname="/date-tasks"
            forcedSearch={forcedSearch}
            isActive={isVisible}
            onShiftDateKey={handleShiftDateKeyInSheet}
            onOpenTaskPickerPage={() => setLocalOverlayLayer("task-picker")}
            onOpenMemoPage={() => setLocalOverlayLayer("memo")}
            onOpenRoutineImportPage={() => setLocalOverlayLayer("routine-import")}
            onOpenRoutineCreatePage={() => setLocalOverlayLayer("routine-create")}
          />
        </div>

        {localOverlayLayer ? (
          <div className="absolute inset-0 z-40 flex min-h-0 flex-col">
            {localOverlayLayer === "routine-import" || localOverlayLayer === "routine-create" ? (
              <DateTodosRoutineStandaloneLayer
                dateKey={resolvedDateKey}
                mode={localOverlayLayer === "routine-import" ? "import" : "create"}
                swipeCloseEnabled
                onClose={() => setLocalOverlayLayer(null)}
              />
            ) : null}
            {localOverlayLayer === "task-picker" ? (
              <DateTodosTaskPickerStandaloneLayer
                dateKey={resolvedDateKey}
                swipeCloseEnabled
                onClose={() => setLocalOverlayLayer(null)}
              />
            ) : null}
            {localOverlayLayer === "memo" ? (
              <DateTodosMemoStandaloneLayer
                dateKey={resolvedDateKey}
                swipeCloseEnabled
                onClose={() => setLocalOverlayLayer(null)}
              />
            ) : null}
          </div>
        ) : null}
      </section>
    </div>
  );
}
