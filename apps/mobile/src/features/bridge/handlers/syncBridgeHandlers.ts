import {
  readBridgePayloadRecord,
  readBridgeType,
  type ParsedBridgeMessage,
} from "../types";

export type TodoViewSyncPayload = {
  isViewingTodayTodoSurface?: boolean;
  source?: "date-tasks" | "calendar-sheet" | "none";
  dateKey?: string | null;
  routePath?: string;
};

type WeatherSettingsRawPayload = {
  enabled?: unknown;
  mood?: unknown;
  particleClarity?: unknown;
};

export type AuthStateSyncPayload = {
  loggedIn?: unknown;
  token?: unknown;
  apiOrigin?: unknown;
};

export type SyncBridgeHandlerDeps = {
  handleTodoViewSync: (payload: TodoViewSyncPayload) => void;
  applyWeatherSettingsSync: (payload: WeatherSettingsRawPayload) => void;
  refreshNativeWeatherSnapshot: () => Promise<void>;
  /** 웹의 종이 화면이 마운트되거나 다시 로드될 때 현재 비·눈·안개의 표시 상태를 다시 전달한다. */
  dispatchCurrentWeatherVisualState: () => boolean;
  syncFocusLiveActivityAuth: (payload: AuthStateSyncPayload) => Promise<unknown>;
};

export async function handleSyncBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: SyncBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_WEATHER_SETTINGS_SYNC") {
    const payload = readBridgePayloadRecord(parsedData) as WeatherSettingsRawPayload | null;
    if (!payload) {
      return true;
    }

    deps.applyWeatherSettingsSync(payload);
    return true;
  }

  if (messageType === "REST_TODO_VIEW_SYNC") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as TodoViewSyncPayload;
    deps.handleTodoViewSync(payload);
    return true;
  }

  if (messageType === "REST_AUTH_STATE_SYNC") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as AuthStateSyncPayload;
    await deps.syncFocusLiveActivityAuth(payload);
    return true;
  }

  if (messageType === "REST_WEATHER_SNAPSHOT_REQUEST") {
    await deps.refreshNativeWeatherSnapshot();
    return true;
  }

  if (messageType === "REST_PAPER_WEATHER_STATE_REQUEST") {
    deps.dispatchCurrentWeatherVisualState();
    return true;
  }

  return false;
}
