import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type CanvasPoint = {
  x: number;
  y: number;
};

export type HandwritingCanvasHandle = {
  clear: () => void;
  undo: () => void;
  exportImage: () => string | null;
};

type HandwritingCanvasProps = {
  onDrawingChange: (hasDrawing: boolean) => void;
  onStrokeEnd?: () => void;
  className?: string;
};

const STROKE_COLOR = "#254b70";
const STROKE_WIDTH = 4;
const EXPORT_PADDING = 18;
const EXPORT_MIN_SIZE = 256;
const EXPORT_TARGET_LONG_EDGE = 960;
const EXPORT_MAX_SCALE = 4;

/**
 * 손가락·마우스·펜 포인터의 이동 좌표를 선 묶음으로 보관해 캔버스에 그린다.
 * clear와 undo는 화면과 좌표를 함께 갱신한다.
 * exportImage는 실제로 쓴 영역만 여백과 함께 잘라 확대한 뒤, 인식 요청용 흰 배경 PNG를 반환한다.
 */
export const HandwritingCanvas = forwardRef<HandwritingCanvasHandle, HandwritingCanvasProps>(
  function HandwritingCanvas({ onDrawingChange, onStrokeEnd, className }, ref) {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const strokesRef = useRef<CanvasPoint[][]>([]);
    const activeStrokeRef = useRef<CanvasPoint[] | null>(null);

    const getContext = () => canvasRef.current?.getContext("2d") ?? null;

    const drawStroke = (context: CanvasRenderingContext2D, stroke: CanvasPoint[]) => {
      if (stroke.length === 0) {
        return;
      }

      context.beginPath();
      context.lineCap = "round";
      context.lineJoin = "round";
      context.strokeStyle = STROKE_COLOR;
      context.lineWidth = STROKE_WIDTH;
      context.moveTo(stroke[0]?.x ?? 0, stroke[0]?.y ?? 0);

      if (stroke.length === 1) {
        context.lineTo((stroke[0]?.x ?? 0) + 0.1, (stroke[0]?.y ?? 0) + 0.1);
      } else {
        for (const point of stroke.slice(1)) {
          context.lineTo(point.x, point.y);
        }
      }
      context.stroke();
    };

    const redraw = () => {
      const canvas = canvasRef.current;
      const context = getContext();
      if (!canvas || !context) {
        return;
      }

      context.clearRect(0, 0, canvas.width, canvas.height);
      for (const stroke of strokesRef.current) {
        drawStroke(context, stroke);
      }
    };

    const resizeCanvas = () => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      const rect = canvas.getBoundingClientRect();
      const previousWidth = canvas.width || rect.width;
      const previousHeight = canvas.height || rect.height;
      const nextWidth = Math.max(Math.round(rect.width), 1);
      const nextHeight = Math.max(Math.round(rect.height), 1);
      if (canvas.width === nextWidth && canvas.height === nextHeight) {
        return;
      }

      const scaleX = nextWidth / previousWidth;
      const scaleY = nextHeight / previousHeight;
      strokesRef.current = strokesRef.current.map((stroke) =>
        stroke.map((point) => ({ x: point.x * scaleX, y: point.y * scaleY }))
      );
      canvas.width = nextWidth;
      canvas.height = nextHeight;
      redraw();
    };

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }

      resizeCanvas();
      const observer = new ResizeObserver(resizeCanvas);
      observer.observe(canvas);
      return () => observer.disconnect();
    }, []);

    const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
    };

    const finishStroke = (event: React.PointerEvent<HTMLCanvasElement>) => {
      if (!activeStrokeRef.current) {
        return;
      }
      activeStrokeRef.current = null;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      onDrawingChange(strokesRef.current.length > 0);
      onStrokeEnd?.();
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        strokesRef.current = [];
        activeStrokeRef.current = null;
        redraw();
        onDrawingChange(false);
      },
      undo: () => {
        strokesRef.current = strokesRef.current.slice(0, -1);
        activeStrokeRef.current = null;
        redraw();
        onDrawingChange(strokesRef.current.length > 0);
      },
      exportImage: () => {
        const canvas = canvasRef.current;
        if (!canvas || strokesRef.current.length === 0) {
          return null;
        }

        const points = strokesRef.current.flat();
        if (points.length === 0) {
          return null;
        }

        const minX = Math.min(...points.map((point) => point.x));
        const minY = Math.min(...points.map((point) => point.y));
        const maxX = Math.max(...points.map((point) => point.x));
        const maxY = Math.max(...points.map((point) => point.y));
        const sourceX = Math.max(0, minX - EXPORT_PADDING);
        const sourceY = Math.max(0, minY - EXPORT_PADDING);
        const sourceWidth = Math.max(
          Math.min(canvas.width, maxX + EXPORT_PADDING) - sourceX,
          1
        );
        const sourceHeight = Math.max(
          Math.min(canvas.height, maxY + EXPORT_PADDING) - sourceY,
          1
        );
        const exportScale = Math.min(
          EXPORT_MAX_SCALE,
          Math.max(2, EXPORT_TARGET_LONG_EDGE / Math.max(sourceWidth, sourceHeight))
        );
        const drawingWidth = Math.max(Math.round(sourceWidth * exportScale), 1);
        const drawingHeight = Math.max(Math.round(sourceHeight * exportScale), 1);

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = Math.max(drawingWidth, EXPORT_MIN_SIZE);
        exportCanvas.height = Math.max(drawingHeight, EXPORT_MIN_SIZE);
        const context = exportCanvas.getContext("2d");
        if (!context) {
          return null;
        }

        context.fillStyle = "#fffdf5";
        context.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.drawImage(
          canvas,
          sourceX,
          sourceY,
          sourceWidth,
          sourceHeight,
          (exportCanvas.width - drawingWidth) / 2,
          (exportCanvas.height - drawingHeight) / 2,
          drawingWidth,
          drawingHeight
        );
        return exportCanvas.toDataURL("image/png");
      },
    }));

    return (
      <canvas
        ref={canvasRef}
        className={`handwriting-canvas block h-44 w-full touch-none rounded-2xl ${className ?? ""}`}
        aria-label="손글씨로 할 일 쓰기"
        onPointerDown={(event) => {
          if (event.pointerType === "mouse" && event.button !== 0) {
            return;
          }
          event.currentTarget.setPointerCapture(event.pointerId);
          const stroke = [getCanvasPoint(event)];
          strokesRef.current = [...strokesRef.current, stroke];
          activeStrokeRef.current = stroke;
          redraw();
          onDrawingChange(true);
        }}
        onPointerMove={(event) => {
          const activeStroke = activeStrokeRef.current;
          if (!activeStroke) {
            return;
          }
          activeStroke.push(getCanvasPoint(event));
          redraw();
        }}
        onPointerUp={finishStroke}
        onPointerCancel={finishStroke}
      />
    );
  }
);
