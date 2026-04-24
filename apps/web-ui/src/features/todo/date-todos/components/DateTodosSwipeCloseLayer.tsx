import type { ReactNode } from "react";
import { useEdgeSwipeClose } from "../../../../hooks/useEdgeSwipeClose";

const EDGE_SWIPE_START_MAX_X = 56;
const EDGE_SWIPE_MIN_DISTANCE = 72;
const EDGE_SWIPE_MAX_VERTICAL_DRIFT = 56;
const SWIPE_AXIS_THRESHOLD = 8;
const SWIPE_CLOSE_ANIMATION_MS = 280;

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
  const {
    dragX,
    swipeState,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleTransitionEnd,
  } = useEdgeSwipeClose({
    enabled: swipeCloseEnabled,
    onClose,
    edgeStartMaxX: EDGE_SWIPE_START_MAX_X,
    minDistance: EDGE_SWIPE_MIN_DISTANCE,
    maxVerticalDrift: EDGE_SWIPE_MAX_VERTICAL_DRIFT,
    axisThreshold: SWIPE_AXIS_THRESHOLD,
    closeAnimationMs: SWIPE_CLOSE_ANIMATION_MS,
  });

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
      onTouchStart={(event) => handleTouchStart(event)}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onTransitionEnd={handleTransitionEnd}
    >
      {children}
    </div>
  );
}
