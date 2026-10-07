import { useCallback, useRef } from 'react';

/** 웹의 종이 배경에 표시할 비·눈·안개 상태. 앱 설정과 활성 상태까지 반영한 네이티브 판정 결과다. */
export type WebWeatherVisualState = {
  effect: 'fog' | 'rain' | 'snow' | null;
  mood: 'dreamy' | 'cinematic';
  particleClarity: number;
};

type DispatchBridgeEvent = (event: { type: string; payload: Record<string, unknown> }) => boolean;

/**
 * 비·눈·안개의 최신 상태를 보관하고 RN_PAPER_WEATHER_STATE 이벤트로 웹 배경에 전달한다.
 * 웹 로딩 중 전송에 실패해도 상태는 유지하며, 로드 완료나 웹의 상태 요청에서 다시 보낸다.
 */
export function useWebWeatherBridge(dispatchBridgeEvent: DispatchBridgeEvent) {
  const latestStateRef = useRef<WebWeatherVisualState>({ effect: null, mood: 'dreamy', particleClarity: 70 });

  /** 현재 배경 날씨 상태를 웹에 보낸다. true는 브리지 주입을 요청했다는 뜻이며 웹 렌더링 완료를 의미하지 않는다. */
  const dispatchCurrentWeatherVisualState = useCallback(() => {
    return dispatchBridgeEvent({ type: 'RN_PAPER_WEATHER_STATE', payload: { ...latestStateRef.current } });
  }, [dispatchBridgeEvent]);

  /** 위치 날씨·설정·앱 활성 상태가 바뀐 결과를 보관한 뒤 준비된 웹 화면에 전달한다. */
  const handleWeatherVisualStateChange = useCallback((state: WebWeatherVisualState) => {
    latestStateRef.current = state;
    dispatchCurrentWeatherVisualState();
  }, [dispatchCurrentWeatherVisualState]);

  return { dispatchCurrentWeatherVisualState, handleWeatherVisualStateChange };
}
