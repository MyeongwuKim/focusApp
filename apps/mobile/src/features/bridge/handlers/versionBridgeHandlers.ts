import {
  readBridgeRequestId,
  readBridgeType,
  type ParsedBridgeMessage,
  type SendBridgeResult,
} from "../types";
import type { StoredWebUiReleaseSnapshot, WebUiReleaseChannel } from "../../webui/webUiVersionWorker";

export type VersionBridgeHandlerDeps = {
  sendBridgeResult: SendBridgeResult;
  getNativeAppVersion: () => string | null;
  getStoredWebUiReleaseSnapshot: () => Promise<StoredWebUiReleaseSnapshot | null>;
  webUiReleaseChannel: WebUiReleaseChannel;
  platform: "ios" | "android" | "unknown";
};

export async function handleVersionBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: VersionBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (messageType !== "REST_APP_VERSION_INFO_REQUEST") {
    return false;
  }

  const requestId = readBridgeRequestId(parsedData);
  const releaseSnapshot = await deps.getStoredWebUiReleaseSnapshot();
  deps.sendBridgeResult({
    type: "REST_APP_VERSION_INFO_RESULT",
    requestId,
    payload: {
      appVersion: deps.getNativeAppVersion(),
      webUiVersion: releaseSnapshot?.version ?? null,
      webUiChannel: releaseSnapshot?.channel ?? deps.webUiReleaseChannel,
      platform: deps.platform,
    },
  });

  return true;
}
