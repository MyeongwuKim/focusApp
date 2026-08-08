import Constants from "expo-constants";
import { Linking, Platform } from "react-native";
import type { VersionBridgeHandlerDeps } from "../bridge/handlers/versionBridgeHandlers";
import type { SendBridgeResult } from "../bridge/types";
import {
  readStoredWebUiReleaseSnapshot,
  type WebUiReleaseChannel,
} from "../webui/webUiVersionWorker";
import type { NativeAppVersionPlatform } from "./nativeAppVersionPolicy";

const IOS_APP_STORE_URL = process.env.EXPO_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "";
const ANDROID_PLAY_STORE_URL = process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL?.trim() ?? "";

export function resolveNativeAppVersion() {
  const expoVersion = Constants.expoConfig?.version;
  if (typeof expoVersion === "string" && expoVersion.trim()) return expoVersion.trim();

  const expoClientVersion = (
    Constants.manifest2?.extra as { expoClient?: { version?: string } } | undefined
  )?.expoClient?.version;
  return typeof expoClientVersion === "string" && expoClientVersion.trim()
    ? expoClientVersion.trim()
    : null;
}

function resolveAndroidPackageName() {
  const androidPackage = Constants.expoConfig?.android?.package;
  return typeof androidPackage === "string" && androidPackage.trim()
    ? androidPackage.trim()
    : "com.myeongwu.focushybrid";
}

export async function openNativeAppMarket(remoteStoreUrl?: string | null) {
  const configuredStoreUrl = remoteStoreUrl?.trim();
  if (Platform.OS === "android") {
    const packageName = resolveAndroidPackageName();
    const primaryUrl =
      configuredStoreUrl || ANDROID_PLAY_STORE_URL || `market://details?id=${packageName}`;
    const fallbackUrl = `https://play.google.com/store/apps/details?id=${packageName}`;
    try {
      await Linking.openURL(primaryUrl);
    } catch {
      await Linking.openURL(fallbackUrl);
    }
    return;
  }

  if (Platform.OS === "ios") {
    await Linking.openURL(
      configuredStoreUrl || IOS_APP_STORE_URL || "itms-apps://itunes.apple.com"
    );
  }
}

export function createNativeVersionBridgeDeps(input: {
  sendBridgeResult: SendBridgeResult;
  webUiReleaseChannel: WebUiReleaseChannel;
  platform: NativeAppVersionPlatform;
}): VersionBridgeHandlerDeps {
  return {
    ...input,
    getNativeAppVersion: resolveNativeAppVersion,
    getStoredWebUiReleaseSnapshot: readStoredWebUiReleaseSnapshot,
  };
}
