import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useNativePaperWeatherState } from "./useNativePaperWeatherState";

function WeatherStateConsumer({ name }: { name: string }) {
  const state = useNativePaperWeatherState();
  return <output data-testid={name}>{JSON.stringify(state)}</output>;
}

function sendState(payload: unknown) {
  act(() => {
    window.dispatchEvent(new CustomEvent("focus-hybrid-native-bridge", {
      detail: { type: "RN_PAPER_WEATHER_STATE", payload },
    }));
  });
}

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(window, "ReactNativeWebView");
});

describe("종이 배경의 네이티브 날씨 상태", () => {
  it("동시에 열린 화면이 한 번 구독·요청하고 수동 선택과 끄기 결과를 함께 반영한다", () => {
    const postMessage = vi.fn();
    Object.assign(window, { ReactNativeWebView: { postMessage } });
    render(<><WeatherStateConsumer name="tasks" /><WeatherStateConsumer name="calendar" /></>);
    expect(postMessage).toHaveBeenCalledTimes(1);
    expect(JSON.parse(postMessage.mock.calls[0][0])).toEqual({ type: "REST_PAPER_WEATHER_STATE_REQUEST" });
    sendState({ effect: "fog", mood: "dreamy", particleClarity: 70 });
    expect(screen.getByTestId("tasks")).toHaveTextContent('"effect":"fog"');
    expect(screen.getByTestId("calendar")).toHaveTextContent('"effect":"fog"');
    sendState({ effect: "rain", mood: "dreamy", particleClarity: 70 });
    expect(screen.getByTestId("tasks")).toHaveTextContent('"effect":"rain"');
    expect(screen.getByTestId("calendar")).toHaveTextContent('"effect":"rain"');
    sendState({ effect: "snow", mood: "cinematic", particleClarity: 120 });
    expect(screen.getByTestId("tasks")).toHaveTextContent('"effect":"snow"');
    expect(screen.getByTestId("calendar")).toHaveTextContent('"particleClarity":100');
    sendState({ effect: null, mood: "cinematic", particleClarity: 30 });
    expect(screen.getByTestId("tasks")).toHaveTextContent('"effect":null');
    expect(screen.getByTestId("calendar")).toHaveTextContent('"particleClarity":30');
  });

  it("잘못된 메시지를 무시하고 모든 화면을 닫았다 다시 열면 오래된 효과를 표시하지 않는다", () => {
    const view = render(<WeatherStateConsumer name="state" />);
    sendState({ effect: "fog", mood: "dreamy", particleClarity: 70 });
    sendState({ effect: "thunder", mood: "dreamy", particleClarity: 70 });
    sendState({ effect: null, mood: "dreamy", particleClarity: NaN });
    expect(screen.getByTestId("state")).toHaveTextContent('"effect":"fog"');
    view.unmount();
    sendState({ effect: "fog", mood: "dreamy", particleClarity: 100 });
    render(<WeatherStateConsumer name="new-page" />);
    expect(screen.getByTestId("new-page")).toHaveTextContent('"effect":null');
  });
});
