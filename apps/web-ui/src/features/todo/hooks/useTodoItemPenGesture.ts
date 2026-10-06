import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  areOpposingTodoDiagonals,
  recognizeTodoPenStroke,
  type TodoPenPoint,
} from "../utils/recognizeTodoPenGesture";

type UseTodoItemPenGestureParams = {
  disabled: boolean;
  canComplete: boolean;
  onComplete: () => void;
  onDelete: () => void;
};

type StoredDiagonal = {
  points: TodoPenPoint[];
  expiresAt: number;
  surface: "item" | "gutter";
};

/**
 * Apple Pencil·스타일러스는 할 일 항목 전체에서, 손가락·마우스는 오른쪽 제스처 여백에서 궤적을 수집한다.
 * V는 완료로 변환하고, 충분히 긴 가로 취소선 또는 펜으로 그린 X·끄적임은 삭제로 변환한다.
 * 오른쪽 여백의 짧은 사선은 무시해 손가락이 스친 동작으로 삭제되지 않게 한다.
 * 오른쪽 여백 밖의 손가락 입력은 스크롤에 맡긴다.
 */
export function useTodoItemPenGesture({
  disabled,
  canComplete,
  onComplete,
  onDelete,
}: UseTodoItemPenGestureParams) {
  const activePointerIdRef = useRef<number | null>(null);
  const cardRectRef = useRef<DOMRect | null>(null);
  const recognitionWidthRef = useRef(0);
  const pathOffsetRef = useRef({ x: 0, y: 0 });
  const activeSurfaceRef = useRef<"item" | "gutter">("item");
  const pointsRef = useRef<TodoPenPoint[]>([]);
  const previousDiagonalRef = useRef<StoredDiagonal | null>(null);
  const diagonalTimerRef = useRef<number | null>(null);
  const clearPathTimerRef = useRef<number | null>(null);
  const gestureHelpTimerRef = useRef<number | null>(null);
  const [strokePath, setStrokePath] = useState("");
  const [strokeTone, setStrokeTone] = useState<"ink" | "complete" | "delete">("ink");
  const [isDeleteGuideVisible, setIsDeleteGuideVisible] = useState(false);
  const [isGestureHelpVisible, setIsGestureHelpVisible] = useState(false);

  const clearDiagonal = () => {
    previousDiagonalRef.current = null;
    if (diagonalTimerRef.current !== null) {
      window.clearTimeout(diagonalTimerRef.current);
      diagonalTimerRef.current = null;
    }
  };

  const schedulePathClear = () => {
    if (clearPathTimerRef.current !== null) {
      window.clearTimeout(clearPathTimerRef.current);
    }
    clearPathTimerRef.current = window.setTimeout(() => setStrokePath(""), 420);
  };

  /** 오른쪽 제스처 여백의 사용법을 잠시 표시하고 2.4초 뒤 자동으로 닫는다. */
  const showGestureHelp = () => {
    if (gestureHelpTimerRef.current !== null) {
      window.clearTimeout(gestureHelpTimerRef.current);
    }
    setIsGestureHelpVisible(true);
    gestureHelpTimerRef.current = window.setTimeout(() => {
      setIsGestureHelpVisible(false);
      gestureHelpTimerRef.current = null;
    }, 2400);
  };

  const hideGestureHelp = () => {
    if (gestureHelpTimerRef.current !== null) {
      window.clearTimeout(gestureHelpTimerRef.current);
      gestureHelpTimerRef.current = null;
    }
    setIsGestureHelpVisible(false);
  };

  useEffect(() => {
    return () => {
      clearDiagonal();
      if (clearPathTimerRef.current !== null) {
        window.clearTimeout(clearPathTimerRef.current);
      }
      if (gestureHelpTimerRef.current !== null) {
        window.clearTimeout(gestureHelpTimerRef.current);
      }
    };
  }, []);

  const appendPoint = (event: ReactPointerEvent<HTMLElement>) => {
    const rect = cardRectRef.current;
    if (!rect) {
      return;
    }
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    pointsRef.current = [...pointsRef.current, point];
    const firstPoint = pointsRef.current[0];
    const horizontalDistance = Math.abs(point.x - firstPoint.x);
    const verticalDistance = Math.abs(point.y - firstPoint.y);
    const isHorizontalDeleteStroke =
      horizontalDistance >= 10 && horizontalDistance >= Math.max(verticalDistance * 1.6, 10);
    setIsDeleteGuideVisible(isHorizontalDeleteStroke);
    setStrokeTone(isHorizontalDeleteStroke ? "delete" : "ink");
    const command = pointsRef.current.length === 1 ? "M" : "L";
    const pathX = point.x + pathOffsetRef.current.x;
    const pathY = point.y + pathOffsetRef.current.y;
    setStrokePath((current) => `${current} ${command}${pathX.toFixed(1)},${pathY.toFixed(1)}`.trim());
  };

  const startGesture = (
    event: ReactPointerEvent<HTMLElement>,
    surface: "item" | "gutter"
  ) => {
    event.preventDefault();
    event.stopPropagation();

    const surfaceRect = event.currentTarget.getBoundingClientRect();
    const itemRect =
      surface === "gutter"
        ? event.currentTarget.closest<HTMLElement>(".todo-item-card")?.getBoundingClientRect() ?? surfaceRect
        : surfaceRect;
    activePointerIdRef.current = event.pointerId;
    activeSurfaceRef.current = surface;
    cardRectRef.current = surfaceRect;
    recognitionWidthRef.current = itemRect.width;
    pathOffsetRef.current = {
      x: surfaceRect.left - itemRect.left,
      y: surfaceRect.top - itemRect.top,
    };
    pointsRef.current = [];
    setStrokePath("");
    setStrokeTone("ink");
    setIsDeleteGuideVisible(false);
    hideGestureHelp();
    event.currentTarget.setPointerCapture(event.pointerId);
    appendPoint(event);
  };

  const finishGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();

    const points = pointsRef.current;
    const cardWidth = recognitionWidthRef.current;
    const gesture = recognizeTodoPenStroke(points, cardWidth);
    const firstPoint = points[0];
    const isTap = Boolean(firstPoint) && points.every(
      (point) => Math.hypot(point.x - firstPoint.x, point.y - firstPoint.y) < 8
    );
    activePointerIdRef.current = null;
    cardRectRef.current = null;
    recognitionWidthRef.current = 0;
    pointsRef.current = [];
    setIsDeleteGuideVisible(false);

    if (gesture === "check" && canComplete) {
      clearDiagonal();
      setStrokeTone("complete");
      schedulePathClear();
      onComplete();
      return;
    }

    if (gesture === "strike" || (gesture === "delete" && activeSurfaceRef.current === "item")) {
      clearDiagonal();
      setStrokeTone("delete");
      schedulePathClear();
      onDelete();
      return;
    }

    if (gesture === "diagonal") {
      if (activeSurfaceRef.current === "gutter") {
        clearDiagonal();
        schedulePathClear();
        return;
      }

      const previous = previousDiagonalRef.current;
      if (
        previous &&
        previous.surface === activeSurfaceRef.current &&
        previous.expiresAt >= Date.now() &&
        areOpposingTodoDiagonals(previous.points, points)
      ) {
        clearDiagonal();
        setStrokeTone("delete");
        schedulePathClear();
        onDelete();
        return;
      }
      previousDiagonalRef.current = {
        points,
        expiresAt: Date.now() + 900,
        surface: activeSurfaceRef.current,
      };
      if (diagonalTimerRef.current !== null) {
        window.clearTimeout(diagonalTimerRef.current);
      }
      diagonalTimerRef.current = window.setTimeout(clearDiagonal, 900);
    }

    if (isTap) {
      showGestureHelp();
    }

    setStrokeTone("ink");
    schedulePathClear();
  };

  const cancelGesture = (event: ReactPointerEvent<HTMLElement>) => {
    if (activePointerIdRef.current !== event.pointerId) {
      return;
    }
    activePointerIdRef.current = null;
    cardRectRef.current = null;
    recognitionWidthRef.current = 0;
    pointsRef.current = [];
    setStrokeTone("ink");
    setIsDeleteGuideVisible(false);
    schedulePathClear();
  };

  return {
    strokePath,
    strokeTone,
    isDeleteGuideVisible,
    isGestureHelpVisible,
    gestureProps: {
      onPointerDownCapture: (event: ReactPointerEvent<HTMLElement>) => {
        if (disabled || event.pointerType !== "pen") {
          return;
        }
        if (event.target instanceof Element && event.target.closest("button, input, textarea, select")) {
          return;
        }
        startGesture(event, "item");
      },
      onPointerMoveCapture: (event: ReactPointerEvent<HTMLElement>) => {
        if (activePointerIdRef.current !== event.pointerId) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        appendPoint(event);
      },
      onPointerUpCapture: finishGesture,
      onPointerCancelCapture: cancelGesture,
    },
    gestureZoneProps: {
      onPointerDown: (event: ReactPointerEvent<HTMLElement>) => {
        if (
          disabled ||
          (event.pointerType !== "touch" && event.pointerType !== "mouse") ||
          (event.pointerType === "mouse" && event.button !== 0)
        ) {
          return;
        }
        startGesture(event, "gutter");
      },
      onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => {
        if (disabled || (event.key !== "Enter" && event.key !== " ")) {
          return;
        }
        event.preventDefault();
        showGestureHelp();
      },
    },
  };
}
