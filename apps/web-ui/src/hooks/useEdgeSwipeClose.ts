import { useCallback, useEffect, useRef, useState, type TouchEventHandler, type TransitionEventHandler } from "react";
import { useSwipeCore } from "./useSwipeCore";

export type EdgeSwipeState = "idle" | "dragging" | "settling" | "closing";

type UseEdgeSwipeCloseOptions = {
  enabled?: boolean;
  onClose: () => void;
  edgeStartMaxX?: number;
  minDistance?: number;
  maxVerticalDrift?: number;
  axisThreshold?: number;
  closeAnimationMs?: number;
};

type TouchStartOptions = {
  canSwipeBack?: boolean;
  onEdgeTouchStart?: () => void;
};

const DEFAULT_VIEWPORT_WIDTH = 390;

export function useEdgeSwipeClose({
  enabled = true,
  onClose,
  edgeStartMaxX = 56,
  minDistance = 72,
  maxVerticalDrift = 56,
  axisThreshold = 8,
  closeAnimationMs = 280,
}: UseEdgeSwipeCloseOptions) {
  const [dragX, setDragX] = useState(0);
  const [swipeState, setSwipeState] = useState<EdgeSwipeState>("idle");
  const canSwipeBackRef = useRef(false);
  const closeTimeoutRef = useRef<number | null>(null);

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current !== null) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  const settleOrReset = useCallback((currentDragX: number) => {
    if (currentDragX > 0) {
      setSwipeState("settling");
      setDragX(0);
      return;
    }
    setSwipeState("idle");
  }, []);

  const startClosing = useCallback(
    (dragXOverride?: number) => {
      if (!enabled) {
        onClose();
        return;
      }

      clearCloseTimeout();
      const viewportWidth = dragXOverride ?? (window.innerWidth || DEFAULT_VIEWPORT_WIDTH);
      setSwipeState("closing");
      setDragX(viewportWidth);
      closeTimeoutRef.current = window.setTimeout(() => {
        closeTimeoutRef.current = null;
        onClose();
      }, closeAnimationMs);
    },
    [closeAnimationMs, clearCloseTimeout, enabled, onClose]
  );

  const {
    handleTouchStart: startSwipeCore,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    reset: resetSwipeCore,
  } = useSwipeCore({
    axisThreshold,
    onHorizontalMove: ({ deltaX }) => {
      if (!enabled || swipeState === "closing" || !canSwipeBackRef.current) {
        return;
      }

      if (deltaX <= 0) {
        if (dragX !== 0) {
          setDragX(0);
        }
        setSwipeState("dragging");
        return;
      }

      setSwipeState("dragging");
      const viewportWidth = window.innerWidth || DEFAULT_VIEWPORT_WIDTH;
      const limitedDeltaX = Math.min(deltaX, viewportWidth * 1.08);
      const nextDragX =
        limitedDeltaX <= viewportWidth
          ? limitedDeltaX
          : viewportWidth + (limitedDeltaX - viewportWidth) * 0.24;
      setDragX(nextDragX);
    },
    onEnd: ({ axis, deltaX, deltaY }) => {
      if (!enabled) {
        canSwipeBackRef.current = false;
        return;
      }

      const canSwipeBack = canSwipeBackRef.current;
      canSwipeBackRef.current = false;

      if (!canSwipeBack || axis !== "horizontal") {
        if (swipeState === "dragging") {
          settleOrReset(dragX);
          return;
        }
        setSwipeState("idle");
        return;
      }

      const closeThreshold = Math.max(
        minDistance,
        Math.min((window.innerWidth || DEFAULT_VIEWPORT_WIDTH) * 0.24, 112)
      );
      const shouldClose =
        deltaX > closeThreshold &&
        Math.abs(deltaY) <= maxVerticalDrift &&
        Math.abs(deltaX) > Math.abs(deltaY);

      if (shouldClose) {
        startClosing();
        return;
      }

      settleOrReset(dragX);
    },
    onCancel: () => {
      canSwipeBackRef.current = false;
      settleOrReset(dragX);
    },
  });

  const resetInteraction = useCallback(() => {
    clearCloseTimeout();
    canSwipeBackRef.current = false;
    resetSwipeCore();
    setSwipeState("idle");
    setDragX(0);
  }, [clearCloseTimeout, resetSwipeCore]);

  useEffect(() => {
    return () => {
      clearCloseTimeout();
    };
  }, [clearCloseTimeout]);

  const handleTouchStart = useCallback(
    (event: Parameters<TouchEventHandler<HTMLElement>>[0], options?: TouchStartOptions) => {
      if (!enabled || swipeState === "closing") {
        return;
      }

      const touch = event.touches[0];
      const canSwipeBack = options?.canSwipeBack ?? touch.clientX <= edgeStartMaxX;
      canSwipeBackRef.current = canSwipeBack;

      if (canSwipeBack && touch.clientX <= edgeStartMaxX) {
        options?.onEdgeTouchStart?.();
      }

      startSwipeCore(event, { canStart: canSwipeBack });
    },
    [edgeStartMaxX, enabled, startSwipeCore, swipeState]
  );

  const handleTransitionEnd: TransitionEventHandler<HTMLElement> = useCallback(
    (event) => {
      if (event.currentTarget !== event.target) {
        return;
      }
      if (swipeState === "settling") {
        setSwipeState("idle");
      }
    },
    [swipeState]
  );

  return {
    dragX,
    swipeState,
    setDragX,
    setSwipeState,
    startClosing,
    resetInteraction,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    handleTransitionEnd,
  };
}
