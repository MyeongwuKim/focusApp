import {
  readBridgePayloadRecord,
  readBridgeType,
  type ParsedBridgeMessage,
} from "../types";

export type FocusLiveActivityPayload = {
  todoId?: unknown;
  dateKey?: unknown;
  title?: unknown;
  startedAtMs?: unknown;
  deviationSeconds?: unknown;
  pausedAtMs?: unknown;
  isPaused?: unknown;
  targetFocusMinutes?: unknown;
  deepLink?: unknown;
  deepLinkPath?: unknown;
};

export type FocusLiveActivityBridgeHandlerDeps = {
  startFocusLiveActivity: (payload: FocusLiveActivityPayload) => Promise<unknown>;
  updateFocusLiveActivity: (payload: FocusLiveActivityPayload) => Promise<unknown>;
  endFocusLiveActivity: (payload: Pick<FocusLiveActivityPayload, "todoId" | "dateKey">) => Promise<unknown>;
};

export async function handleFocusLiveActivityBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: FocusLiveActivityBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_FOCUS_LIVE_ACTIVITY_START") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as FocusLiveActivityPayload;
    await deps.startFocusLiveActivity(payload);
    return true;
  }

  if (messageType === "REST_FOCUS_LIVE_ACTIVITY_UPDATE") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as FocusLiveActivityPayload;
    await deps.updateFocusLiveActivity(payload);
    return true;
  }

  if (messageType === "REST_FOCUS_LIVE_ACTIVITY_END") {
    const payload = (readBridgePayloadRecord(parsedData) ?? {}) as FocusLiveActivityPayload;
    await deps.endFocusLiveActivity({
      todoId: payload.todoId,
      dateKey: payload.dateKey,
    });
    return true;
  }

  return false;
}
