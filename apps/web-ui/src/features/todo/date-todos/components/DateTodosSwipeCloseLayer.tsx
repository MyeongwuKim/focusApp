import { useEffect, useRef, useState, type ReactNode } from "react";

const EDGE_SWIPE_START_MAX_X = 56;
const EDGE_SWIPE_MIN_DISTANCE = 72;
const EDGE_SWIPE_MAX_VERTICAL_DRIFT = 56;
const SWIPE_AXIS_THRESHOLD = 8;
const SWIPE_CLOSE_ANIMATION_MS = 280;

type SwipeState = "idle" | "dragging" | "settling" | "closing";
type TouchStartState = {
  x: number;
  y: number;
  canSwipeBack: boolean;
  axis: "horizontal" | "vertical" | null;
};

type DateTodosSwipeCloseLayerProps = {
  onClose: () => void;
  swipeCloseEnabled?: boolean;
  children: ReactNode;
};

export function DateTodosSwipeCloseLayer({
  onClose,
  swipeCloseEnabled = false,
  children,
}: DateTodosSwipeCloseLayerProps) {
  const [dragX, setDragX] = useState(0);
  const [swipeState, setSwipeState] = useState<SwipeState>("idle");
  const touchStartRef = useRef<TouchStartState | null>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current !== null) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const closeWithAnimation = () => {
    if (!swipeCloseEnabled) {
      onClose();
      return;
    }

    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    const viewportWidth = window.innerWidth || 390;
    setSwipeState("closing");
    setDragX(viewportWidth);
    closeTimeoutRef.current = window.setTimeout(() => {
      closeTimeoutRef.current = null;
      onClose();
    }, SWIPE_CLOSE_ANIMATION_MS);
  };

  const handleTouchStart: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!swipeCloseEnabled || swipeState === "closing") {
      return;
    }
    const touch = event.touches[0];
    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
      canSwipeBack: touch.clientX <= EDGE_SWIPE_START_MAX_X,
      axis: null,
    };
  };

  const handleTouchMove: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!swipeCloseEnabled) {
      return;
    }
    const start = touchStartRef.current;
    if (!start || !start.canSwipeBack || swipeState === "closing") {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;

    if (!start.axis) {
      if (Math.abs(deltaX) < SWIPE_AXIS_THRESHOLD && Math.abs(deltaY) < SWIPE_AXIS_THRESHOLD) {
        return;
      }
      start.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
    }

    if (start.axis !== "horizontal") {
      return;
    }

    if (deltaX <= 0) {
      if (dragX !== 0) {
        setDragX(0);
      }
      setSwipeState("dragging");
      return;
    }

    event.preventDefault();
    setSwipeState("dragging");
    const viewportWidth = window.innerWidth || 390;
    const limitedDeltaX = Math.min(deltaX, viewportWidth * 1.08);
    const nextDragX =
      limitedDeltaX <= viewportWidth
        ? limitedDeltaX
        : viewportWidth + (limitedDeltaX - viewportWidth) * 0.24;
    setDragX(nextDragX);
  };

  const handleTouchEnd: React.TouchEventHandler<HTMLDivElement> = (event) => {
    if (!swipeCloseEnabled) {
      return;
    }
    const start = touchStartRef.current;
    if (!start) {
      return;
    }

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    const closeThreshold = Math.max(
      EDGE_SWIPE_MIN_DISTANCE,
      Math.min((window.innerWidth || 390) * 0.24, 112)
    );
    const shouldClose =
      start.canSwipeBack &&
      start.axis === "horizontal" &&
      deltaX > closeThreshold &&
      Math.abs(deltaY) <= EDGE_SWIPE_MAX_VERTICAL_DRIFT &&
      Math.abs(deltaX) > Math.abs(deltaY);

    touchStartRef.current = null;

    if (shouldClose) {
      closeWithAnimation();
      return;
    }

    if (dragX > 0) {
      setSwipeState("settling");
      setDragX(0);
      return;
    }

    setSwipeState("idle");
  };

  return (
    <div
      className="relative flex min-h-0 flex-1 flex-col bg-base-100"
      style={
        swipeState === "idle"
          ? undefined
          : {
              transform: `translateX(${dragX}px)`,
              transformOrigin: "left center",
              transition:
                swipeState === "dragging"
                  ? "none"
                  : "transform 280ms cubic-bezier(0.22,1,0.36,1)",
            }
      }
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onTransitionEnd={(event) => {
        if (event.currentTarget !== event.target) {
          return;
        }
        if (swipeState === "settling") {
          setSwipeState("idle");
        }
      }}
    >
      {children}
    </div>
  );
}
