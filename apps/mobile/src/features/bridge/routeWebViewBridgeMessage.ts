import { handleAuthBridgeMessage, type AuthBridgeHandlerDeps } from "./handlers/authBridgeHandlers";
import {
  handleLocationBridgeMessage,
  type LocationBridgeHandlerDeps,
} from "./handlers/locationBridgeHandlers";
import {
  handleFocusLiveActivityBridgeMessage,
  type FocusLiveActivityBridgeHandlerDeps,
} from "./handlers/focusLiveActivityBridgeHandlers";
import {
  handleNotificationBridgeMessage,
  type NotificationBridgeHandlerDeps,
} from "./handlers/notificationBridgeHandlers";
import { handleSyncBridgeMessage, type SyncBridgeHandlerDeps } from "./handlers/syncBridgeHandlers";
import { handleVersionBridgeMessage, type VersionBridgeHandlerDeps } from "./handlers/versionBridgeHandlers";
import type { ParsedBridgeMessage } from "./types";

export type RouteWebViewBridgeDeps = {
  sync: SyncBridgeHandlerDeps;
  notification: NotificationBridgeHandlerDeps;
  location: LocationBridgeHandlerDeps;
  version: VersionBridgeHandlerDeps;
  auth: AuthBridgeHandlerDeps;
  focusLiveActivity: FocusLiveActivityBridgeHandlerDeps;
};

export async function routeWebViewBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: RouteWebViewBridgeDeps
): Promise<boolean> {
  if (await handleSyncBridgeMessage(parsedData, deps.sync)) {
    return true;
  }

  if (await handleNotificationBridgeMessage(parsedData, deps.notification)) {
    return true;
  }

  if (await handleVersionBridgeMessage(parsedData, deps.version)) {
    return true;
  }

  if (await handleAuthBridgeMessage(parsedData, deps.auth)) {
    return true;
  }

  if (await handleFocusLiveActivityBridgeMessage(parsedData, deps.focusLiveActivity)) {
    return true;
  }

  if (await handleLocationBridgeMessage(parsedData, deps.location)) {
    return true;
  }

  return false;
}
