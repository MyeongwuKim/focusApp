import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { PageHeader } from "../components/PageHeader";
import { shiftDateKey } from "../features/calendar/utils/date";
import { DateTodosTurnPreview } from "../features/todo/date-todos/components/DateTodosTurnPreview";
import {
  resolvePageTurnDurationMs,
  shouldCompletePageTurn,
} from "../features/todo/date-todos/utils/pageTurnMotion";
import { useHorizontalSwipeGesture } from "../hooks/useHorizontalSwipeGesture";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { formatDateKey } from "../utils/holidays";
import { DateTodosRoutePage } from "./DateTodosRoutePage";
import { NativePaperWeatherLayer } from "../features/weather/components/NativePaperWeatherLayer";

type TodayTasksRootPageProps = {
  isActive: boolean;
  search: string;
};

const PAGE_TURN_FALLBACK_BUFFER_MS = 180;

function isPageSwipeBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "button",
        "input",
        "textarea",
        "select",
        "[role='button']",
        "[role='slider']",
        "[contenteditable='true']",
        "[data-disable-date-sheet-swipe='true']",
      ].join(",")
    )
  );
}

/**
 * 앱을 열었을 때 가장 먼저 보여 주는 할 일 화면이다.
 * 다른 메뉴가 위에 열린 동안에는 오늘 날짜를 유지하고, 활성 상태에서는 URL의 날짜를 사용해 날짜 이동 결과를 표시한다.
 */
export function TodayTasksRootPage({ isActive, search }: TodayTasksRootPageProps) {
  const { goPage } = useAppNavigation();
  const backgroundSearch = useMemo(() => {
    return `?date=${encodeURIComponent(formatDateKey(new Date()))}`;
  }, []);
  const visibleSearch = isActive ? search : backgroundSearch;
  const visibleDateKey = useMemo(
    () => new URLSearchParams(visibleSearch).get("date") ?? formatDateKey(new Date()),
    [visibleSearch]
  );
  const [dragX, setDragX] = useState(0);
  const [viewportWidth, setViewportWidth] = useState(1);
  const [settleDirection, setSettleDirection] = useState<-1 | 0 | 1>(0);
  const [pendingDateKey, setPendingDateKey] = useState<string | null>(null);
  const [isSettling, setIsSettling] = useState(false);
  const [isAwaitingDateCommit, setIsAwaitingDateCommit] = useState(false);
  const [settleDurationMs, setSettleDurationMs] = useState(460);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const hasCompletedSettleRef = useRef(false);

  const resetPageTurn = useCallback(() => {
    setPendingDateKey(null);
    setSettleDirection(0);
    setIsSettling(false);
    setIsAwaitingDateCommit(false);
    setDragX(0);
  }, []);

  const completePageTurn = useCallback(() => {
    if (hasCompletedSettleRef.current) {
      return;
    }
    hasCompletedSettleRef.current = true;

    if (pendingDateKey) {
      setIsAwaitingDateCommit(true);
      goPage("/date-tasks", {
        query: { date: pendingDateKey },
        replace: true,
      });
      return;
    }

    resetPageTurn();
  }, [goPage, pendingDateKey, resetPageTurn]);

  /**
   * 넘겨질 날짜가 URL에 반영되기 전에는 목표 날짜 종이를 화면 위에 유지한다.
   * 날짜 반영과 애니메이션 정리를 같은 페인트 전에 처리해 이전 날짜가 한 프레임 다시 드러나지 않게 한다.
   */
  useLayoutEffect(() => {
    if (!isAwaitingDateCommit || !pendingDateKey || visibleDateKey !== pendingDateKey) {
      return;
    }
    resetPageTurn();
  }, [isAwaitingDateCommit, pendingDateKey, resetPageTurn, visibleDateKey]);

  const {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  } = useHorizontalSwipeGesture({
    canStart: (event) => isActive && !isSettling && !isPageSwipeBlockedTarget(event.target),
    onStart: () => {
      hasCompletedSettleRef.current = false;
      setIsAwaitingDateCommit(false);
      setViewportWidth(stageRef.current?.clientWidth ?? 1);
      setDragX(0);
    },
    onHorizontalMove: ({ deltaX }) => {
      const maxDistance = Math.max(viewportWidth * 0.92, 1);
      setDragX(Math.max(-maxDistance, Math.min(deltaX, maxDistance)));
    },
    onEnd: ({ axis, deltaX, velocityX }) => {
      if (axis !== "horizontal") {
        setDragX(0);
        setPendingDateKey(null);
        setSettleDirection(0);
        setIsSettling(false);
        return;
      }

      setSettleDurationMs(resolvePageTurnDurationMs(velocityX));

      if (shouldCompletePageTurn(deltaX, velocityX)) {
        const direction = deltaX < 0 ? -1 : 1;
        const shiftDays = deltaX < 0 ? 1 : -1;
        setPendingDateKey(shiftDateKey(visibleDateKey, shiftDays));
        setSettleDirection(direction);
        setIsSettling(true);
        setDragX(0);
        return;
      }

      if (Math.abs(deltaX) <= 0.5) {
        setPendingDateKey(null);
        setSettleDirection(0);
        setIsSettling(false);
        setDragX(0);
        return;
      }

      setPendingDateKey(null);
      setSettleDirection(deltaX < 0 ? -1 : 1);
      setIsSettling(true);
      setDragX(0);
    },
    onCancel: () => {
      if (Math.abs(dragX) <= 0.5) {
        setPendingDateKey(null);
        setSettleDirection(0);
        setIsSettling(false);
        setDragX(0);
        return;
      }
      setPendingDateKey(null);
      setSettleDirection(dragX < 0 ? -1 : 1);
      setIsSettling(true);
      setDragX(0);
    },
  });

  const pageTurnProgress = isSettling
    ? pendingDateKey
      ? 1
      : 0
    : Math.min(Math.abs(dragX) / Math.max(viewportWidth * 0.72, 1), 1);
  const pageTurnDirection = settleDirection < 0 || (settleDirection === 0 && dragX < 0)
    ? "next"
    : settleDirection > 0 || dragX > 0
      ? "previous"
      : "idle";
  const underlayDateKey = pendingDateKey ?? (
    pageTurnDirection === "previous"
      ? shiftDateKey(visibleDateKey, -1)
      : shiftDateKey(visibleDateKey, 1)
  );
  const underlaySearch = `?date=${encodeURIComponent(underlayDateKey)}`;
  const stageStyle = {
    "--root-page-turn-progress": pageTurnProgress,
    "--root-page-turn-duration": `${settleDurationMs}ms`,
  } as CSSProperties;
  const pageStyle = {
    transform: pageTurnDirection === "next"
      ? `rotateY(${-pageTurnProgress * 102}deg) translateZ(${pageTurnProgress * 1.5}px)`
      : pageTurnDirection === "previous"
        ? `translateX(${pageTurnProgress * 1.8}%) scale(${1 - pageTurnProgress * 0.012})`
        : "none",
    transformOrigin: "left center",
  } as CSSProperties;
  const underlayStyle = {
    transform: pageTurnDirection === "previous"
      ? `rotateY(${-(1 - pageTurnProgress) * 102}deg) translateZ(${pageTurnProgress * 1.5}px)`
      : "scale(1)",
    transformOrigin: "left center",
  } as CSSProperties;

  /** transitionend가 전달되지 않는 WebView에서도 넘김 상태가 남지 않도록 전환 시간 뒤 강제로 정리한다. */
  useEffect(() => {
    if (!isSettling) {
      return;
    }
    const timer = window.setTimeout(
      completePageTurn,
      settleDurationMs + PAGE_TURN_FALLBACK_BUFFER_MS
    );
    return () => window.clearTimeout(timer);
  }, [completePageTurn, isSettling, settleDurationMs]);

  return (
    <div
      ref={stageRef}
      className="sketchbook-root-page-turn-stage relative flex h-full max-h-full min-h-0 flex-1 overflow-hidden overscroll-none touch-pan-y"
      data-page-turn-direction={pageTurnDirection}
      style={stageStyle}
      onTouchStartCapture={handleTouchStart}
      onTouchMoveCapture={handleTouchMove}
      onTouchEndCapture={handleTouchEnd}
      onTouchCancelCapture={handleTouchCancel}
    >
      {pageTurnDirection !== "idle" ? (
        <div
          className={[
            "sketchbook-root-page-turn-underlay",
            isSettling ? "sketchbook-root-page-turn-underlay--settling" : "",
          ].join(" ")}
          style={underlayStyle}
          aria-hidden="true"
        >
          <div className="sketchbook-page sketchbook-page--tasks relative flex h-full min-h-0 flex-1 flex-col px-1.5 py-1.5">
            <NativePaperWeatherLayer />
            <PageHeader
              route="dateTasks"
              forcedPathname="/date-tasks"
              forcedSearch={underlaySearch}
            />
            <DateTodosTurnPreview dateKey={underlayDateKey} />
          </div>
        </div>
      ) : null}

      <div
        className={[
          "sketchbook-page sketchbook-page--tasks sketchbook-root-page-turn-sheet relative flex h-full max-h-full min-h-0 flex-1 flex-col overflow-hidden overscroll-none px-1.5 py-1.5",
          isSettling ? "sketchbook-root-page-turn-sheet--settling" : "",
        ].join(" ")}
        style={pageStyle}
        onTransitionEnd={(event) => {
          if (
            event.currentTarget !== event.target ||
            event.propertyName !== "transform" ||
            !isSettling
          ) {
            return;
          }

          completePageTurn();
        }}
      >
        <NativePaperWeatherLayer />
        <PageHeader
          route="dateTasks"
          forcedPathname="/date-tasks"
          forcedSearch={visibleSearch}
        />
        <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
          <DateTodosRoutePage
            forcedPathname="/date-tasks"
            forcedSearch={visibleSearch}
            isActive={isActive}
            appearance="sketchbook"
            enableBoardDateSwipe={false}
          />
        </div>
        <div className="sketchbook-root-page-turn-backface" aria-hidden="true" />
        <div className="sketchbook-root-page-turn-curl" aria-hidden="true" />
      </div>
      <div className="sketchbook-root-page-turn-depth" aria-hidden="true" />
    </div>
  );
}
