import { useCallback, useRef, type TouchEventHandler } from "react";

export type SwipeAxis = "horizontal" | "vertical" | null;

type TouchPoint = {
  x: number;
  y: number;
};

type TimedTouchPoint = TouchPoint & {
  time: number;
};

export type SwipeCoreSummary = {
  axis: SwipeAxis;
  deltaX: number;
  deltaY: number;
  /** 손가락이 닿은 시점부터 떨어질 때까지의 시간이다. */
  durationMs: number;
  /** 마지막 이동 구간의 가로 속도다. 양수는 오른쪽, 음수는 왼쪽이며 단위는 px/ms다. */
  velocityX: number;
  /** 마지막 이동 구간의 세로 속도다. 양수는 아래쪽, 음수는 위쪽이며 단위는 px/ms다. */
  velocityY: number;
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
  const touchStartTimeRef = useRef(0);
  const previousTouchPointRef = useRef<TimedTouchPoint | null>(null);
  const latestTouchPointRef = useRef<TimedTouchPoint | null>(null);
  const swipeAxisRef = useRef<SwipeAxis>(null);

  const reset = useCallback(() => {
    touchStartRef.current = null;
    touchStartTimeRef.current = 0;
    previousTouchPointRef.current = null;
    latestTouchPointRef.current = null;
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
      touchStartTimeRef.current = event.timeStamp;
      latestTouchPointRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: event.timeStamp,
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

      previousTouchPointRef.current = latestTouchPointRef.current;
      latestTouchPointRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: event.timeStamp,
      };

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
      const end = {
        x: touch.clientX,
        y: touch.clientY,
      };
      const durationMs = Math.max(event.timeStamp - touchStartTimeRef.current, 1);
      const latestPoint = latestTouchPointRef.current;
      const previousPoint = previousTouchPointRef.current;
      const velocityBase = latestPoint && (
        Math.abs(end.x - latestPoint.x) > 0.5 ||
        Math.abs(end.y - latestPoint.y) > 0.5
      )
        ? latestPoint
        : previousPoint ?? latestPoint;
      const recentDurationMs = velocityBase
        ? Math.max(event.timeStamp - velocityBase.time, 1)
        : durationMs;
      const velocityX = velocityBase
        ? (end.x - velocityBase.x) / recentDurationMs
        : (end.x - start.x) / durationMs;
      const velocityY = velocityBase
        ? (end.y - velocityBase.y) / recentDurationMs
        : (end.y - start.y) / durationMs;
      const summary: SwipeCoreSummary = {
        axis: swipeAxisRef.current,
        deltaX: end.x - start.x,
        deltaY: end.y - start.y,
        durationMs,
        velocityX,
        velocityY,
        start,
        end,
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
