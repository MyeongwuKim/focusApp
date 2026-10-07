import { useSyncExternalStore } from "react";
import { postNativeBridgeMessage } from "../../../utils/nativeBridge";

type PaperWeatherState = {
  effect: "fog" | "rain" | "snow" | null;
  mood: "dreamy" | "cinematic";
  particleClarity: number;
};

const OFF_STATE: PaperWeatherState = { effect: null, mood: "dreamy", particleClarity: 70 };
let currentState = OFF_STATE;
const listeners = new Set<() => void>();

/** 네이티브의 최종 비·눈·안개 표시 결과만 받는다. 알 수 없는 메시지나 잘못된 설정값은 반영하지 않는다. */
function handleNativeWeatherState(event: Event) {
  const detail = (event as CustomEvent<{ type?: string; payload?: Partial<PaperWeatherState> }>).detail;
  if (detail?.type !== "RN_PAPER_WEATHER_STATE") return;
  const payload = detail.payload;
  if (!payload || (payload.effect !== null && payload.effect !== "fog" && payload.effect !== "rain" && payload.effect !== "snow") ||
    (payload.mood !== "dreamy" && payload.mood !== "cinematic") ||
    typeof payload.particleClarity !== "number" || !Number.isFinite(payload.particleClarity)) return;

  const particleClarity = Math.max(0, Math.min(100, payload.particleClarity));
  if (currentState.effect === payload.effect && currentState.mood === payload.mood &&
    currentState.particleClarity === particleClarity) return;
  currentState = { effect: payload.effect, mood: payload.mood, particleClarity };
  listeners.forEach((listener) => listener());
}

/** 첫 종이 화면에서 리스너를 등록한 뒤 현재 상태를 요청한다. 마지막 화면이 사라지면 구독과 캐시를 정리한다. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    window.addEventListener("focus-hybrid-native-bridge", handleNativeWeatherState);
    postNativeBridgeMessage("REST_PAPER_WEATHER_STATE_REQUEST");
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      window.removeEventListener("focus-hybrid-native-bridge", handleNativeWeatherState);
      currentState = OFF_STATE;
    }
  };
}

/** 여러 종이 화면이 동일한 비·눈·안개 상태를 구독한다. 위치 조회·날씨 판정·수동 테스트는 네이티브에 맡긴다. */
export function useNativePaperWeatherState() {
  return useSyncExternalStore(subscribe, () => currentState, () => OFF_STATE);
}
