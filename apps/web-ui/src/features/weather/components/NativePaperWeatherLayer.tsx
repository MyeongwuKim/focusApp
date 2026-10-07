import { useEffect, useRef, useState } from "react";
import { useNativePaperWeatherState } from "../hooks/useNativePaperWeatherState";
import { PaperFogPuffs } from "./PaperFogPuffs";
import { PaperFallingMarks } from "./PaperFallingMarks";
import "../paperWeather.css";

/**
 * 네이티브가 선택한 날씨를 종이 배경 위·글씨와 조작부 아래에 표시한다.
 * 표시 중에만 종이 화면 크기를 관찰하며, 터치·포커스·접근성 읽기에는 참여하지 않는다.
 */
export function NativePaperWeatherLayer() {
  const state = useNativePaperWeatherState();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const isVisible = state.effect !== null;

  useEffect(() => {
    const layer = layerRef.current;
    if (!isVisible || !layer) return;
    const measure = () => {
      const width = layer.clientWidth;
      const height = layer.clientHeight;
      setSize((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(layer);
    return () => observer.disconnect();
  }, [isVisible]);

  if (state.effect === null) return null;
  const cinematic = state.mood === "cinematic";
  return (
    <div ref={layerRef} className={`paper-weather-layer paper-${state.effect}-layer`} aria-hidden="true">
      {size.width > 0 && size.height > 0 ? state.effect === "fog" ? (
        <PaperFogPuffs width={size.width} height={size.height} clarity={state.particleClarity} cinematic={cinematic} />
      ) : (
        <PaperFallingMarks key={state.effect} effect={state.effect} width={size.width} height={size.height}
          clarity={state.particleClarity} cinematic={cinematic} />
      ) : null}
    </div>
  );
}
