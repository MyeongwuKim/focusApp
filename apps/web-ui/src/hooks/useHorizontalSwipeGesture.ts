import type { TouchEventHandler } from "react";
import { useSwipeCore, type SwipeCoreSummary } from "./useSwipeCore";
export type { SwipeAxis } from "./useSwipeCore";

type UseHorizontalSwipeGestureOptions = {
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
  onEnd: (summary: SwipeCoreSummary, event: Parameters<TouchEventHandler<HTMLElement>>[0]) => void;
  onCancel?: () => void;
};

export function useHorizontalSwipeGesture({
  axisThreshold = 8,
  canStart,
  onStart,
  onHorizontalMove,
  onEnd,
  onCancel,
}: UseHorizontalSwipeGestureOptions) {
  return useSwipeCore({
    axisThreshold,
    canStart,
    onStart,
    onHorizontalMove,
    onEnd,
    onCancel,
  });
}
