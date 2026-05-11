import {
  readBridgeRequestId,
  readBridgeType,
  type ParsedBridgeMessage,
  type SendBridgeResult,
} from "../types";

export type NotificationBridgeHandlerDeps = {
  sendBridgeResult: SendBridgeResult;
  requestRestNotificationPermission: () => Promise<void>;
  getRestNotificationPermissionSnapshot: () => Promise<unknown>;
  getRestExpoPushTokenSnapshot: () => Promise<unknown>;
  openAppSettings: () => Promise<void>;
};

export async function handleNotificationBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: NotificationBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_NOTIFICATION_PERMISSION_STATUS_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    const snapshot = await deps.getRestNotificationPermissionSnapshot();
    deps.sendBridgeResult({
      type: "REST_NOTIFICATION_PERMISSION_STATUS_RESULT",
      requestId,
      payload: snapshot,
    });
    return true;
  }

  if (messageType === "REST_NOTIFICATION_PERMISSION_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    await deps.requestRestNotificationPermission();
    const snapshot = await deps.getRestNotificationPermissionSnapshot();
    deps.sendBridgeResult({
      type: "REST_NOTIFICATION_PERMISSION_RESULT",
      requestId,
      payload: snapshot,
    });
    return true;
  }

  if (messageType === "REST_PUSH_TOKEN_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    const snapshot = await deps.getRestExpoPushTokenSnapshot();
    deps.sendBridgeResult({
      type: "REST_PUSH_TOKEN_RESULT",
      requestId,
      payload: snapshot,
    });
    return true;
  }

  if (messageType === "REST_APP_OPEN_SETTINGS") {
    await deps.openAppSettings();
    return true;
  }

  return false;
}
