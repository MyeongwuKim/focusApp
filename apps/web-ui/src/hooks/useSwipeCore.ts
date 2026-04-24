import { useCallback, useRef, type TouchEventHandler } from "react";

export type SwipeAxis = "horizontal" | "vertical" | null;

type TouchPoint = {
  x: number;
  y: number;
};

export type SwipeCoreSummary = {
  axis: SwipeAxis;
  deltaX: number;
  deltaY: number;
  start: TouchPoint;
  end: TouchPoint;
};

type SwipeCoreStartOptions = {
  canStart?: boolean;
};

type UseSwipeCoreOptions = {
  axisThreshold?: number;
  canStart?: (event: Parameters<TouchEventHandler<HTMLElement>>[0]) => boolean;
  onStart?: (event: Parameters<TouchEventHandler<HTMLElement>>[0]) => void;
  onHorizontalMove?: (
    payload: {
      deltaX: number;
      deltaY: number;
    },
    event: Parameters<TouchEventHandler<HTMLElement>>[0]
  ) => void;
  onEnd?: (summary: SwipeCoreSummary, event: Parameters<TouchEventHandler<HTMLElement>>[0]) => void;
  onCancel?: () => void;
};

export function useSwipeCore({
  axisThreshold = 8,
  canStart,
  onStart,
  onHorizontalMove,
  onEnd,
  onCancel,
}: UseSwipeCoreOptions) {
  const touchStartRef = useRef<TouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);

  const reset = useCallback(() => {
    touchStartRef.current = null;
    swipeAxisRef.current = null;
  }, []);

  const handleTouchStart = useCallback(
    (event: Parameters<TouchEventHandler<HTMLElement>>[0], options?: SwipeCoreStartOptions) => {
      const isStartAllowed = options?.canStart ?? (canStart ? canStart(event) : true);
      if (!isStartAllowed) {
        reset();
        return;
      }

      const touch = event.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
      swipeAxisRef.current = null;
      onStart?.(event);
    },
    [canStart, onStart, reset]
  );

  const handleTouchMove: TouchEventHandler<HTMLElement> = useCallback(
    (event) => {
      const start = touchStartRef.current;
      if (!start) {
        return;
      }

      const touch = event.touches[0];
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;

      if (!swipeAxisRef.current) {
        if (Math.abs(deltaX) < axisThreshold && Math.abs(deltaY) < axisThreshold) {
          return;
        }
        swipeAxisRef.current = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
      }

      if (swipeAxisRef.current !== "horizontal") {
        return;
      }

      event.preventDefault();
      onHorizontalMove?.({ deltaX, deltaY }, event);
    },
    [axisThreshold, onHorizontalMove]
  );

  const handleTouchEnd: TouchEventHandler<HTMLElement> = useCallback(
    (event) => {
      const start = touchStartRef.current;
      if (!start) {
        return;
      }

      const touch = event.changedTouches[0];
      const summary: SwipeCoreSummary = {
        axis: swipeAxisRef.current,
        deltaX: touch.clientX - start.x,
        deltaY: touch.clientY - start.y,
        start,
        end: {
          x: touch.clientX,
          y: touch.clientY,
        },
      };

      reset();
      onEnd?.(summary, event);
    },
    [onEnd, reset]
  );

  const handleTouchCancel = useCallback(() => {
    reset();
    onCancel?.();
  }, [onCancel, reset]);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
    reset,
  };
}
