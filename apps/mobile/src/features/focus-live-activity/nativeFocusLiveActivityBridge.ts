import { NativeModules, Platform } from "react-native";
import type { AuthStateSyncPayload } from "../bridge/handlers/syncBridgeHandlers";
import type {
  FocusLiveActivityBridgeHandlerDeps,
  FocusLiveActivityControlEventAckPayload,
  FocusLiveActivityPayload,
} from "../bridge/handlers/focusLiveActivityBridgeHandlers";
import { readUnknownRecord } from "../../shared/nativeValues";

type FocusLiveActivityNativeModule = {
  configure?: (payload: AuthStateSyncPayload) => Promise<unknown>;
  start?: (payload: FocusLiveActivityPayload) => Promise<unknown>;
  update?: (payload: FocusLiveActivityPayload) => Promise<unknown>;
  end?: (payload: Pick<FocusLiveActivityPayload, "todoId" | "dateKey">) => Promise<unknown>;
  consumePendingControlEvent?: () => Promise<unknown>;
  currentActivitySnapshot?: () => Promise<unknown>;
};

function getFocusLiveActivityNativeModule(): FocusLiveActivityNativeModule | null {
  const nativeModulesRecord = readUnknownRecord(NativeModules);
  const nativeModule = readUnknownRecord(nativeModulesRecord?.FocusLiveActivityModule);
  return nativeModule ? (nativeModule as FocusLiveActivityNativeModule) : null;
}

export async function callFocusLiveActivityModule(
  method: "configure" | "start" | "update" | "end",
  payload: FocusLiveActivityPayload | AuthStateSyncPayload
) {
  if (Platform.OS !== "ios") {
    return { supported: false, reason: "UNSUPPORTED_PLATFORM" };
  }

  const nativeMethod = getFocusLiveActivityNativeModule()?.[method];
  if (typeof nativeMethod !== "function") {
    return { supported: false, reason: "NATIVE_MODULE_UNAVAILABLE" };
  }
  return await nativeMethod(payload);
}

export async function consumePendingFocusLiveActivityControlEvent() {
  if (Platform.OS !== "ios") return null;
  const nativeMethod = getFocusLiveActivityNativeModule()?.consumePendingControlEvent;
  return typeof nativeMethod === "function" ? await nativeMethod() : null;
}

export async function getCurrentFocusLiveActivitySnapshot() {
  if (Platform.OS !== "ios") return null;
  const nativeMethod = getFocusLiveActivityNativeModule()?.currentActivitySnapshot;
  return typeof nativeMethod === "function" ? await nativeMethod() : null;
}

export function createNativeFocusLiveActivityBridgeDeps(
  ackFocusLiveActivityControlEvent: (
    payload: FocusLiveActivityControlEventAckPayload
  ) => void
): FocusLiveActivityBridgeHandlerDeps {
  return {
    startFocusLiveActivity: (payload) => callFocusLiveActivityModule("start", payload),
    updateFocusLiveActivity: (payload) => callFocusLiveActivityModule("update", payload),
    endFocusLiveActivity: (payload) => callFocusLiveActivityModule("end", payload),
    ackFocusLiveActivityControlEvent,
  };
}
