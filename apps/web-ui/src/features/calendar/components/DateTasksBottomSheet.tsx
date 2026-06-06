import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FiCheckCircle, FiChevronDown, FiChevronRight, FiChevronUp, FiEdit3, FiFileText, FiHelpCircle } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { PageHelpModal } from "../../../components/PageHelpModal";
import { getPageHelpGuide } from "../../../config/pageHelpGuide";
import { DateTodosMemoStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosMemoStandaloneLayer";
import { DateTodosRoutineStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosRoutineStandaloneLayer";
import { DateTodosTaskPickerStandaloneLayer } from "../../../features/todo/date-todos/components/DateTodosTaskPickerStandaloneLayer";
import { DateTodosRoutePage } from "../../../pages/DateTodosRoutePage";
import { useAppStore } from "../../../stores";
import { formatDateKey } from "../../../utils/holidays";

type DateTasksBottomSheetProps = {
  isVisible: boolean;
  isExpanded: boolean;
  selectedMemoPreview?: string | null;
  selectedTasks?: SelectedTaskItem[];
  restFinishedRequested?: boolean;
  focusTargetElapsedRequested?: boolean;
  startTodoPromptRequested?: boolean;
  focusTargetTodoId?: string | null;
  startTodoPromptAt?: string | null;
  startTodoPromptSource?: string | null;
  onExpandedChange: (isExpanded: boolean) => void;
};

type SelectedTaskItem = {
  label: string;
  done: boolean;
};

const EXPAND_THRESHOLD_PX = 56;
const COLLAPSE_THRESHOLD_PX = 132;
const LOCAL_OVERLAY_HISTORY_KEY = "__dateTasksLocalOverlay";

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

function isLocalOverlayHistoryState(state: unknown) {
  return Boolean(
    state &&
      typeof state === "object" &&
      LOCAL_OVERLAY_HISTORY_KEY in state
  );
}

export function DateTasksBottomSheet({
  isVisible,
  isExpanded,
  selectedMemoPreview = null,
  selectedTasks = [],
  restFinishedRequested = false,
  focusTargetElapsedRequested = false,
  startTodoPromptRequested = false,
  focusTargetTodoId = null,
  startTodoPromptAt = null,
  startTodoPromptSource = null,
  onExpandedChange,
}: DateTasksBottomSheetProps) {
  type LocalOverlayLayer = "routine-import" | "routine-create" | "task-picker" | "memo" | null;
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const viewMonth = useAppStore((state) => state.viewMonth);
  const [viewportHeight, setViewportHeight] = useState(getViewportHeight);
  const [sheetContainerHeight, setSheetContainerHeight] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [isHeaderDragging, setIsHeaderDragging] = useState(false);
  const [localOverlayLayer, setLocalOverlayLayer] = useState<LocalOverlayLayer>(null);
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const [barHeight, setBarHeight] = useState(94);
  const sheetContainerRef = useRef<HTMLDivElement | null>(null);
  const headerTouchStartYRef = useRef<number | null>(null);
  const barRef = useRef<HTMLDivElement | null>(null);
  const localOverlayLayerRef = useRef<LocalOverlayLayer>(null);
  const helpGuide = useMemo(() => getPageHelpGuide("/date-tasks"), []);

  const resolvedDateKey = selectedDateKey ?? formatDateKey(new Date());
  const forcedSearch = useMemo(() => {
    const params = new URLSearchParams({
      date: resolvedDateKey,
    });
    if (restFinishedRequested) {
      params.set("restFinished", "1");
    }
    if (focusTargetElapsedRequested) {
      params.set("focusTargetElapsed", "1");
    }
    if (startTodoPromptRequested) {
      params.set("startTodoPrompt", "1");
    }
    if (focusTargetTodoId) {
      params.set("todoId", focusTargetTodoId);
    }
    if (startTodoPromptAt) {
      params.set("promptAt", startTodoPromptAt);
    }
    if (startTodoPromptSource) {
      params.set("startTodoPromptSource", startTodoPromptSource);
    }
    return `?${params.toString()}`;
  }, [
    resolvedDateKey,
    restFinishedRequested,
    focusTargetElapsedRequested,
    startTodoPromptRequested,
    focusTargetTodoId,
    startTodoPromptAt,
    startTodoPromptSource,
  ]);
  const selectedDateLabel = formatSelectedDate(resolvedDateKey);
  const today = new Date();
  const todayDateKey = formatDateKey(today);
  const isViewingCurrentMonth =
    viewMonth.getFullYear() === today.getFullYear() && viewMonth.getMonth() === today.getMonth();
  const canGoToday = resolvedDateKey !== todayDateKey || !isViewingCurrentMonth;
  const hasMemoPreview = Boolean(selectedMemoPreview);
  const completedTaskCount = selectedTasks.filter((task) => task.done).length;
  const isLocalOverlayOpen = localOverlayLayer !== null;
  const effectiveContainerHeight = sheetContainerHeight > 0 ? sheetContainerHeight : viewportHeight;
  const collapsedVisibleHeight = Math.min(effectiveContainerHeight, barHeight);
  const collapsedOffset = Math.max(0, effectiveContainerHeight - collapsedVisibleHeight);

  const baseOffset = isExpanded ? 0 : collapsedOffset;
  const translateY = Math.min(collapsedOffset, Math.max(0, baseOffset + dragY));
  const bridgeTop = Math.max(0, translateY - 34);
  const isBridgeDragHandleEnabled = !isExpanded && !isLocalOverlayOpen;
  const isSheetHeaderDragEnabled = !isLocalOverlayOpen;
  const bridgeOpacity = isBridgeDragHandleEnabled || (!isExpanded && isHeaderDragging) ? 1 : 0;

  const setLocalOverlayLayerState = useCallback((nextLayer: LocalOverlayLayer) => {
    localOverlayLayerRef.current = nextLayer;
    setLocalOverlayLayer(nextLayer);
  }, []);

  const openLocalOverlayLayer = useCallback(
    (nextLayer: Exclude<LocalOverlayLayer, null>) => {
      setLocalOverlayLayerState(nextLayer);

      if (typeof window === "undefined") {
        return;
      }

      const currentState = window.history.state;
      const nextState = {
        ...(currentState && typeof currentState === "object" ? currentState : {}),
        [LOCAL_OVERLAY_HISTORY_KEY]: nextLayer,
      };
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`;

      if (isLocalOverlayHistoryState(currentState)) {
        window.history.replaceState(nextState, "", currentUrl);
        return;
      }

      window.history.pushState(nextState, "", currentUrl);
    },
    [setLocalOverlayLayerState]
  );

  const closeLocalOverlayLayer = useCallback(() => {
    setLocalOverlayLayerState(null);

    if (typeof window === "undefined") {
      return;
    }

    if (isLocalOverlayHistoryState(window.history.state)) {
      window.history.back();
    }
  }, [setLocalOverlayLayerState]);

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
    if (typeof window === "undefined") {
      return;
    }

    const handlePopState = () => {
      if (!localOverlayLayerRef.current) {
        return;
      }
      setLocalOverlayLayerState(null);
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [setLocalOverlayLayerState]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }
    const nextBarHeight = Math.round(barRef.current?.getBoundingClientRect().height ?? 94);
    if (Number.isFinite(nextBarHeight) && nextBarHeight > 0) {
      setBarHeight(nextBarHeight);
    }
  }, [isExpanded, isVisible, selectedDateLabel, selectedMemoPreview, selectedTasks.length]);

  useEffect(() => {
    if (!isVisible) {
      setDragY(0);
      setIsHeaderDragging(false);
      setLocalOverlayLayerState(null);
      setIsHelpModalOpen(false);
      headerTouchStartYRef.current = null;
    }
  }, [isVisible, setLocalOverlayLayerState]);

  if (!isVisible) {
    return null;
  }

  const handleHeaderTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!isSheetHeaderDragEnabled) {
      return;
    }

    const touch = event.touches[0];
    headerTouchStartYRef.current = touch.clientY;
    setIsHeaderDragging(true);
  };

  const handleHeaderTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!isSheetHeaderDragEnabled) {
      return;
    }

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
    if (!isSheetHeaderDragEnabled) {
      setIsHeaderDragging(false);
      headerTouchStartYRef.current = null;
      setDragY(0);
      return;
    }

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

  const handlePreviewActionTouchStart: React.TouchEventHandler<HTMLElement> = (event) => {
    event.stopPropagation();
  };

  return (
    <div
      ref={sheetContainerRef}
      className={[
        "absolute inset-0 z-30",
        isHelpModalOpen ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-x-0 z-40 flex touch-pan-y justify-center",
          isBridgeDragHandleEnabled ? "pointer-events-auto" : "pointer-events-none",
        ].join(" ")}
        style={{
          top: `${bridgeTop}px`,
          opacity: bridgeOpacity,
          transition: isHeaderDragging
            ? "none"
            : "top 260ms cubic-bezier(0.22,1,0.36,1), opacity 180ms ease",
        }}
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        onTouchCancel={handleHeaderTouchEnd}
        aria-hidden={false}
      >
        <div className="relative h-[34px] w-full">
          <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-b from-transparent via-base-100/28 to-base-100/78" />
          <div className="absolute left-1/2 top-[9px] h-1.5 w-12 -translate-x-1/2 rounded-full bg-base-content/28" />
        </div>
      </div>

      <section
        className={[
          "absolute inset-x-0 top-0 bottom-0 flex flex-col overflow-hidden border border-base-300 bg-base-100/98 shadow-[0_-14px_40px_rgba(15,23,42,0.24)]",
          isHelpModalOpen ? "pointer-events-none" : "pointer-events-auto",
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
            isLocalOverlayOpen ? "shrink-0 pointer-events-none opacity-100" : "shrink-0 opacity-100",
          ].join(" ")}
          onTouchStart={handleHeaderTouchStart}
          onTouchMove={handleHeaderTouchMove}
          onTouchEnd={handleHeaderTouchEnd}
          onTouchCancel={handleHeaderTouchEnd}
          aria-hidden={false}
        >
          <div className="border-t border-base-300/70 bg-base-200/75 px-2.5 py-2">
            <div className="relative min-h-10">
              <div className="absolute left-0 top-1/2 -translate-y-1/2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base-content/45 transition-colors hover:bg-base-100/45"
                  onClick={() => onExpandedChange(!isExpanded)}
                  aria-label={isExpanded ? "오늘할일 접기" : "오늘할일 펼치기"}
                  tabIndex={0}
                >
                  {isExpanded ? <FiChevronDown size={16} /> : <FiChevronUp size={16} />}
                </button>
              </div>

              <div className="pointer-events-none absolute left-1/2 top-1/2 w-[calc(100%-11rem)] -translate-x-1/2 -translate-y-1/2">
                <button
                  type="button"
                  className="pointer-events-auto w-full min-w-0 rounded-lg px-2 py-1 text-center text-[15px] font-semibold tracking-tight text-base-content/90 transition-colors hover:bg-base-100/40"
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
              </div>

              <div className="absolute right-0 top-1/2 flex -translate-y-1/2 items-center justify-end gap-1.5">
                <Button
                  className={[
                    "h-8 min-h-8 border-base-300 bg-base-100 px-3 text-xs font-semibold text-base-content shadow-sm",
                    canGoToday ? "" : "pointer-events-none invisible",
                  ].join(" ")}
                  onClick={handleGoToday}
                  tabIndex={canGoToday ? 0 : -1}
                  aria-hidden={!canGoToday}
                >
                  오늘
                </Button>
                {helpGuide ? (
                  <button
                    type="button"
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full text-base-content/45 transition-colors hover:bg-base-100/45"
                    onClick={() => setIsHelpModalOpen(true)}
                    aria-label="오늘할일 안내 보기"
                    tabIndex={0}
                  >
                    <FiHelpCircle size={17} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          {!isExpanded ? (
            <div className="border-t border-base-300/55 bg-base-100/92 px-4 pb-[calc(0.9rem+env(safe-area-inset-bottom))] pt-2.5">
              <section className="rounded-xl border border-info/20 bg-info/8 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-info">
                    <FiFileText size={13} className="shrink-0" />
                    <span className="truncate">선택한 날짜 메모</span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-base-300 bg-base-100 px-2 text-[11px] font-semibold text-base-content/75 shadow-sm"
                    onTouchStart={handlePreviewActionTouchStart}
                    onClick={() => {
                      onExpandedChange(true);
                      openLocalOverlayLayer("memo");
                    }}
                  >
                    <FiEdit3 size={12} />
                    {hasMemoPreview ? "수정" : "작성"}
                  </button>
                </div>

                <p
                  className={[
                    "m-0 mt-1.5 line-clamp-2 text-[13px] leading-5",
                    hasMemoPreview ? "whitespace-pre-line text-base-content/82" : "text-base-content/56",
                  ].join(" ")}
                >
                  {selectedMemoPreview ?? "아직 남긴 메모가 없어요."}
                </p>

                <div className="mt-2 flex items-center justify-between gap-3 border-t border-info/15 pt-2">
                  <div className="flex min-w-0 items-center gap-1.5 text-[11px] text-base-content/58">
                    <FiCheckCircle size={12} className="shrink-0 text-success/75" />
                    <span className="truncate">
                      할 일 {selectedTasks.length}개
                      {selectedTasks.length > 0 ? ` · 완료 ${completedTaskCount}개` : ""}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-7 shrink-0 items-center gap-0.5 rounded-full px-2 text-[11px] font-semibold text-base-content/70"
                    onTouchStart={handlePreviewActionTouchStart}
                    onClick={() => onExpandedChange(true)}
                  >
                    상세
                    <FiChevronRight size={12} />
                  </button>
                </div>
              </section>
            </div>
          ) : null}
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
          <DateTodosRoutePage
            forcedPathname="/date-tasks"
            forcedSearch={forcedSearch}
            isActive={isVisible}
            onShiftDateKey={handleShiftDateKeyInSheet}
            onOpenTaskPickerPage={() => openLocalOverlayLayer("task-picker")}
            onOpenMemoPage={() => openLocalOverlayLayer("memo")}
            onOpenRoutineImportPage={() => openLocalOverlayLayer("routine-import")}
            onOpenRoutineCreatePage={() => openLocalOverlayLayer("routine-create")}
          />
        </div>

        {localOverlayLayer ? (
          <div className="absolute inset-0 z-40 flex min-h-0 flex-col">
            {localOverlayLayer === "routine-import" || localOverlayLayer === "routine-create" ? (
              <DateTodosRoutineStandaloneLayer
                dateKey={resolvedDateKey}
                mode={localOverlayLayer === "routine-import" ? "import" : "create"}
                swipeCloseEnabled
                onClose={closeLocalOverlayLayer}
              />
            ) : null}
            {localOverlayLayer === "task-picker" ? (
              <DateTodosTaskPickerStandaloneLayer
                dateKey={resolvedDateKey}
                swipeCloseEnabled
                onClose={closeLocalOverlayLayer}
              />
            ) : null}
            {localOverlayLayer === "memo" ? (
              <DateTodosMemoStandaloneLayer
                dateKey={resolvedDateKey}
                swipeCloseEnabled
                onClose={closeLocalOverlayLayer}
              />
            ) : null}
          </div>
        ) : null}
      </section>
      <PageHelpModal
        isOpen={isHelpModalOpen}
        guide={helpGuide}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </div>
  );
}
