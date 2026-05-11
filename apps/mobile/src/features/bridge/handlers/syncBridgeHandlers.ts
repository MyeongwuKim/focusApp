import {
  readBridgePayloadRecord,
  readBridgeType,
  type ParsedBridgeMessage,
} from "../types";

export type TodoSessionSyncPayload = {
  active?: boolean;
  dateKey?: string | null;
  todoId?: string | null;
  startedAt?: string | null;
  sessionId?: string | null;
  syncedAtMs?: number;
};

type WeatherSettingsRawPayload = {
  enabled?: unknown;
  mood?: unknown;
  particleClarity?: unknown;
};

export type SyncBridgeHandlerDeps = {
  handleTodoSessionSync: (payload: TodoSessionSyncPayload) => Promise<void>;
  applyWeatherSettingsSync: (payload: WeatherSettingsRawPayload) => void;
};

export async function handleSyncBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: SyncBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_TODO_SESSION_SYNC") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as TodoSessionSyncPayload;
    await deps.handleTodoSessionSync(payload);
    return true;
  }

  if (messageType === "REST_WEATHER_SETTINGS_SYNC") {
    const payload = readBridgePayloadRecord(parsedData) as WeatherSettingsRawPayload | null;
    if (!payload) {
      return true;
    }

    deps.applyWeatherSettingsSync(payload);
    return true;
  }

  if (messageType === "REST_AUTH_STATE_SYNC") {
    // push permission intro 는 네이티브 첫 진입 시점에서 처리
    return true;
  }

  return false;
}
