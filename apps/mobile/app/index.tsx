import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import * as ExpoLocation from "expo-location";
import { Feather } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Easing,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  login as loginWithKakaoTalk,
  unlink as unlinkKakao,
  type KakaoOAuthToken,
} from "@react-native-seoul/kakao-login";
import NaverLogin from "@react-native-seoul/naver-login";
import { useRestNotificationBridge } from "../src/features/notifications/hooks/useRestNotificationBridge";
import {
  PermissionIntroModal,
} from "../src/features/permissions/components/PermissionIntroModal";
import {
  NativeUpdateRequiredModal,
} from "../src/features/version/components/NativeUpdateRequiredModal";
import {
  applyNativeWeatherSettings,
  NativeWeatherLayer,
} from "../src/features/weather/components/NativeWeatherLayer";
import { routeWebViewBridgeMessage } from "../src/features/bridge/routeWebViewBridgeMessage";
import type { TodoViewSyncPayload } from "../src/features/bridge/handlers/syncBridgeHandlers";
import { embeddedWebUiFiles } from "../src/features/webui/embeddedWebUiBundle";
import {
  prepareWebUiBundleVersion,
  readStoredWebUiReleaseSnapshot,
  resolveWebUiManifestUrl,
  resolveWebUiReleaseChannel,
  type WebUiVersionProgress,
} from "../src/features/webui/webUiVersionWorker";

const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const NATIVE_PROVIDER_LOGIN_TIMEOUT_MS = 35000;
const NATIVE_SESSION_EXCHANGE_TIMEOUT_MS = 30000;
const NOTIFICATION_PERMISSION_INTRO_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""
}native-notification-permission-intro-v1.json`;
const LAUNCH_ANIMATION_RING_DURATION_MS = 900;
const LAUNCH_ANIMATION_CHECK_DURATION_MS = 280;
const LAUNCH_ANIMATION_PAUSE_MS = 280;
const LAUNCH_OVERLAY_MIN_VISIBLE_MS = 800;
const LAUNCH_PROGRESS_BAR_WIDTH = 196;
const DEFAULT_NATIVE_APP_SCHEME = "mobile";
const FORCE_LAUNCH_OVERLAY_FOR_TEST = process.env.EXPO_PUBLIC_FORCE_LAUNCH_OVERLAY === "true";

type NativePermissionState = "granted" | "denied" | "undetermined";
type LocationPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: NativePermissionState;
};
type NativeCoordinates = {
  latitude: number;
  longitude: number;
};
type LocationCoordinatesSnapshot = LocationPermissionSnapshot & {
  coordinates: NativeCoordinates | null;
};
type GeolocationLike = {
  getCurrentPosition: (
    success: (position: { coords?: { latitude?: number; longitude?: number } }) => void,
    failure: (error?: unknown) => void,
    options?: { enableHighAccuracy?: boolean; timeout?: number; maximumAge?: number }
  ) => void;
};

type NativeTodoViewSnapshot = {
  isViewingTodayTodoSurface: boolean;
  source: "date-tasks" | "calendar-sheet" | "none";
  dateKey: string | null;
  routePath: string | null;
};

type NativeWeatherSnapshot = {
  temperature: number;
  weatherCode: number;
  isDay: number;
  coordinates: NativeCoordinates;
  source: "device";
  updatedAt: string;
};

type NativeKakaoAuthResult = {
  token: string;
  userId: string;
};
type NativeNaverAuthResult = {
  token: string;
  userId: string;
};
type AuthProvider = "kakao" | "naver";
const NAVER_NATIVE_CONSUMER_KEY = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim() ?? "";
const NAVER_NATIVE_CONSUMER_SECRET = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim() ?? "";
const NAVER_NATIVE_URL_SCHEME = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim() ?? "";
const NAVER_NATIVE_APP_NAME =
  process.env.EXPO_PUBLIC_NAVER_APP_NAME?.trim() ??
  (Constants.expoConfig?.name?.trim() || "focus-hybrid");
const NAVER_DISABLE_APP_AUTH_IOS = process.env.EXPO_PUBLIC_NAVER_DISABLE_APP_AUTH_IOS === "true";
const IOS_APP_STORE_URL = process.env.EXPO_PUBLIC_IOS_APP_STORE_URL?.trim() ?? "";
const ANDROID_PLAY_STORE_URL = process.env.EXPO_PUBLIC_ANDROID_PLAY_STORE_URL?.trim() ?? "";
let isNaverLoginInitialized = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(errorCode));
    }, timeoutMs);

    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function readUnknownRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readUnknownString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveNativeErrorSignals(error: unknown) {
  const signals = new Set<string>();

  if (error instanceof Error) {
    const errorMessage = readUnknownString(error.message);
    if (errorMessage) {
      signals.add(errorMessage.toLowerCase());
    }
  }

  const errorRecord = readUnknownRecord(error);
  if (errorRecord) {
    const message = readUnknownString(errorRecord.message);
    const code = readUnknownString(errorRecord.code);
    if (message) {
      signals.add(message.toLowerCase());
    }
    if (code) {
      signals.add(code.toLowerCase());
    }

    const userInfo = readUnknownRecord(errorRecord.userInfo);
    const nativeMessage = readUnknownString(userInfo?.nativeErrorMessage);
    if (nativeMessage) {
      signals.add(nativeMessage.toLowerCase());
    }
  }

  const asString = readUnknownString(typeof error === "string" ? error : "");
  if (asString) {
    signals.add(asString.toLowerCase());
  }

  return Array.from(signals);
}

function resolveNativeErrorCode(error: unknown, fallbackCode: string) {
  const errorRecord = readUnknownRecord(error);
  const code = readUnknownString(errorRecord?.code);
  if (code) {
    return code;
  }

  if (error instanceof Error) {
    const message = readUnknownString(error.message);
    if (message) {
      return message;
    }
  }

  const message = readUnknownString(errorRecord?.message);
  if (message) {
    return message;
  }

  return fallbackCode;
}

function resolveWebUiStartupErrorCode(error: unknown) {
  const code = resolveNativeErrorCode(error, "WEB_UI_STARTUP_FAILED");
  return code.trim().toUpperCase();
}

function resolveWebUiStartupErrorMessage(error: unknown) {
  const code = resolveWebUiStartupErrorCode(error);

  if (code.startsWith("WEB_UI_MANIFEST_")) {
    return "버전 정보를 가져오는데 실패했습니다. 다시 실행해주세요.";
  }

  if (code === "WEB_UI_BUNDLE_EXTRACT_FAILED" || code === "WEB_UI_INDEX_MISSING_IN_ZIP") {
    return "R2 번들 압축 해제에 실패했습니다. 다시 실행해주세요.";
  }

  if (code.startsWith("WEB_UI_BUNDLE_")) {
    return "웹 번들 다운로드에 실패했습니다. 다시 실행해주세요.";
  }

  if (code.startsWith("WEB_UI_NATIVE_VERSION_UNSUPPORTED")) {
    return "앱 업데이트가 필요합니다. 최신 버전으로 업데이트한 뒤 다시 실행해주세요.";
  }

  return "앱 시작에 실패했습니다. 다시 실행해주세요.";
}

function isNativeVersionUnsupportedStartupError(error: unknown) {
  return resolveWebUiStartupErrorCode(error).startsWith("WEB_UI_NATIVE_VERSION_UNSUPPORTED");
}

function resolveAndroidPackageName() {
  const androidPackage = Constants.expoConfig?.android?.package;
  if (typeof androidPackage === "string" && androidPackage.trim()) {
    return androidPackage.trim();
  }

  return "com.myeongwu.focushybrid";
}

function normalizeNativeAppScheme(rawScheme: unknown) {
  if (typeof rawScheme !== "string") {
    return "";
  }

  const scheme = rawScheme
    .trim()
    .replace(/:\/\/.*$/, "")
    .replace(/:$/, "")
    .toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : "";
}

function resolveNativeAppScheme() {
  const expoScheme = Constants.expoConfig?.scheme;
  if (Array.isArray(expoScheme)) {
    const firstScheme = expoScheme.map(normalizeNativeAppScheme).find(Boolean);
    if (firstScheme) {
      return firstScheme;
    }
  }

  const normalizedExpoScheme = normalizeNativeAppScheme(expoScheme);
  if (normalizedExpoScheme) {
    return normalizedExpoScheme;
  }

  return normalizeNativeAppScheme(process.env.EXPO_PUBLIC_APP_SCHEME) || DEFAULT_NATIVE_APP_SCHEME;
}

function hasNativeAppProtocol(rawUrl: string, nativeAppScheme: string) {
  try {
    const parsed = new URL(rawUrl);
    return normalizeNativeAppScheme(parsed.protocol) === nativeAppScheme;
  } catch {
    return false;
  }
}

async function openNativeAppMarket() {
  if (Platform.OS === "android") {
    const packageName = resolveAndroidPackageName();
    const primaryUrl = ANDROID_PLAY_STORE_URL || `market://details?id=${packageName}`;
    const fallbackUrl = `https://play.google.com/store/apps/details?id=${packageName}`;

    try {
      await Linking.openURL(primaryUrl);
      return;
    } catch {
      await Linking.openURL(fallbackUrl);
      return;
    }
  }

  if (Platform.OS === "ios") {
    const storeUrl = IOS_APP_STORE_URL || "itms-apps://itunes.apple.com";
    await Linking.openURL(storeUrl);
  }
}

function closeAppFromFatalStartupError() {
  const exitAndroidApp = () => {
    if (Platform.OS !== "android") {
      return;
    }

    setTimeout(() => {
      BackHandler.exitApp();
    }, 0);
    setTimeout(() => {
      BackHandler.exitApp();
    }, 250);
  };

  const nativeModulesRecord = readUnknownRecord(NativeModules);
  const nativeAppControl = readUnknownRecord(nativeModulesRecord?.NativeAppControl);
  const rnExitApp = readUnknownRecord(nativeModulesRecord?.RNExitApp);
  const exitAppFn = nativeAppControl?.exitApp ?? rnExitApp?.exitApp;
  if (typeof exitAppFn === "function") {
    try {
      exitAppFn();
    } finally {
      exitAndroidApp();
    }
    return;
  }

  exitAndroidApp();
}

function showWebUiStartupErrorAlert(error: unknown) {
  Alert.alert(
    "앱 시작 오류",
    resolveWebUiStartupErrorMessage(error),
    [
      {
        text: "확인",
        onPress: closeAppFromFatalStartupError,
      },
    ],
    { cancelable: false }
  );
}

function isNativeLoginCancelledError(error: unknown) {
  const signals = resolveNativeErrorSignals(error);
  return signals.some(
    (signal) =>
      signal.includes("cancel") ||
      signal.includes("canceled") ||
      signal.includes("cancelled") ||
      signal.includes("usercancel")
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]"
  );
}

function resolveHybridApiOrigin() {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envOrigin?.trim()) {
    const cleaned = envOrigin
      .trim()
      .replace(/\/graphql\/?$/i, "")
      .replace(/\/+$/, "");
    return cleaned;
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    const hostMatch = scriptUrl.match(/^[a-z]+:\/\/([^/:?#]+)/i);
    const host = hostMatch?.[1];
    if (host && !isLoopbackHost(host)) {
      return `http://${host}:4000`;
    }
  }

  const expoHostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    null;
  const expoHost = expoHostUri?.split(":")[0];
  if (expoHost && !isLoopbackHost(expoHost)) {
    return `http://${expoHost}:4000`;
  }

  return "http://localhost:4000";
}

function buildWebUiUriWithHash(baseUri: string, callbackHash: string) {
  if (!callbackHash) {
    return baseUri;
  }
  const normalizedHash = callbackHash.startsWith("#") ? callbackHash : `#${callbackHash}`;
  const sanitizedBase = baseUri.split("#")[0];
  return `${sanitizedBase}${normalizedHash}`;
}

function parseTodoViewSnapshotFromWebViewUrl(rawUrl: string): NativeTodoViewSnapshot {
  try {
    const parsed = new URL(rawUrl);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const normalizedHash = hash.startsWith("/") ? hash : `/${hash}`;
    const [pathname, rawSearch = ""] = normalizedHash.split("?", 2);
    const searchParams = new URLSearchParams(rawSearch);
    const todayKey = formatLocalDateKey(new Date());

    if (pathname === "/date-tasks") {
      const dateKey = searchParams.get("date") ?? todayKey;
      return {
        isViewingTodayTodoSurface: dateKey === todayKey,
        source: "date-tasks",
        dateKey,
        routePath: normalizedHash,
      };
    }

    if (pathname === "/calendar" && searchParams.get("sheet") === "1") {
      const dateKey = searchParams.get("date") ?? todayKey;
      return {
        isViewingTodayTodoSurface: dateKey === todayKey,
        source: "calendar-sheet",
        dateKey,
        routePath: normalizedHash,
      };
    }
  } catch {
    // ignore invalid URL
  }

  return {
    isViewingTodayTodoSurface: false,
    source: "none",
    dateKey: null,
    routePath: null,
  };
}

function convertCalendarSheetPathToDateTasksPath(targetPath: string) {
  if (!targetPath.startsWith("/calendar")) {
    return targetPath;
  }

  const [pathname, rawSearch = ""] = targetPath.split("?", 2);
  if (pathname !== "/calendar") {
    return targetPath;
  }

  const params = new URLSearchParams(rawSearch);
  if (params.get("sheet") !== "1") {
    return targetPath;
  }

  const dateKey = params.get("date");
  if (!dateKey) {
    return targetPath;
  }

  const next = new URLSearchParams();
  next.set("date", dateKey);
  if (params.get("restFinished") === "1") {
    next.set("restFinished", "1");
  }
  if (params.get("focusTargetElapsed") === "1") {
    next.set("focusTargetElapsed", "1");
  }
  if (params.get("startTodoPrompt") === "1") {
    next.set("startTodoPrompt", "1");
  }
  const startTodoPromptSource = params.get("startTodoPromptSource");
  if (startTodoPromptSource) {
    next.set("startTodoPromptSource", startTodoPromptSource);
  }
  const promptAt = params.get("promptAt");
  if (promptAt) {
    next.set("promptAt", promptAt);
  }
  const todoId = params.get("todoId");
  if (todoId) {
    next.set("todoId", todoId);
  }
  return `/date-tasks?${next.toString()}`;
}

function resolveLaunchProgressPercent(statusMessage: WebUiVersionProgress) {
  switch (statusMessage) {
    case "초기 번들 준비중...":
      return 22;
    case "버전 체크중...":
      return 46;
    case "앱 번들 설치중...":
      return 78;
    case "앱 시작중...":
      return 100;
    default:
      return 0;
  }
}

function resolveNativeAppVersion() {
  const expoVersion = Constants.expoConfig?.version;
  if (typeof expoVersion === "string" && expoVersion.trim()) {
    return expoVersion.trim();
  }

  const expoClientVersion = (Constants.manifest2?.extra as { expoClient?: { version?: string } } | undefined)
    ?.expoClient?.version;
  if (typeof expoClientVersion === "string" && expoClientVersion.trim()) {
    return expoClientVersion.trim();
  }

  return null;
}

async function requestNativeKakaoOAuthToken(): Promise<KakaoOAuthToken> {
  try {
    return await withTimeout(
      loginWithKakaoTalk(),
      NATIVE_PROVIDER_LOGIN_TIMEOUT_MS,
      "KAKAO_NATIVE_TALK_LOGIN_TIMEOUT"
    );
  } catch (talkError) {
    if (isNativeLoginCancelledError(talkError)) {
      throw new Error("KAKAO_NATIVE_LOGIN_CANCELLED");
    }
    throw talkError;
  }
}

function initializeNaverLoginSdk() {
  if (isNaverLoginInitialized) {
    return;
  }

  if (!NAVER_NATIVE_CONSUMER_KEY || !NAVER_NATIVE_CONSUMER_SECRET || !NAVER_NATIVE_URL_SCHEME) {
    throw new Error("NAVER_NATIVE_CONFIG_MISSING");
  }

  NaverLogin.initialize({
    appName: NAVER_NATIVE_APP_NAME,
    consumerKey: NAVER_NATIVE_CONSUMER_KEY,
    consumerSecret: NAVER_NATIVE_CONSUMER_SECRET,
    serviceUrlSchemeIOS: NAVER_NATIVE_URL_SCHEME,
    disableNaverAppAuthIOS: NAVER_DISABLE_APP_AUTH_IOS,
  });
  isNaverLoginInitialized = true;
}

async function requestNativeNaverAccessToken(): Promise<string> {
  initializeNaverLoginSdk();
  const loginResult = await withTimeout(
    NaverLogin.login(),
    NATIVE_PROVIDER_LOGIN_TIMEOUT_MS,
    "NAVER_NATIVE_LOGIN_TIMEOUT"
  );
  if (loginResult.isSuccess) {
    const accessToken = loginResult.successResponse?.accessToken?.trim();
    if (accessToken) {
      return accessToken;
    }
    throw new Error("NAVER_NATIVE_ACCESS_TOKEN_MISSING");
  }

  const failureMessage = loginResult.failureResponse?.message?.trim();
  if (loginResult.failureResponse?.isCancel) {
    throw new Error("NAVER_NATIVE_LOGIN_CANCELLED");
  }
  throw new Error(failureMessage || "NAVER_NATIVE_LOGIN_FAILED");
}

async function exchangeKakaoAccessTokenForSession(input: {
  apiOrigin: string;
  accessToken: string;
}): Promise<NativeKakaoAuthResult> {
  const response = await withTimeout(
    fetch(`${input.apiOrigin}/auth/kakao/native`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: input.accessToken,
      }),
    }),
    NATIVE_SESSION_EXCHANGE_TIMEOUT_MS,
    "KAKAO_NATIVE_EXCHANGE_TIMEOUT"
  );

  if (!response.ok) {
    throw new Error(`KAKAO_NATIVE_AUTH_HTTP_${response.status}`);
  }

  const parsed = (await response.json()) as {
    token?: unknown;
    userId?: unknown;
  };
  if (typeof parsed.token !== "string" || typeof parsed.userId !== "string") {
    throw new Error("KAKAO_NATIVE_AUTH_INVALID_RESPONSE");
  }

  return {
    token: parsed.token,
    userId: parsed.userId,
  };
}

async function exchangeNaverAccessTokenForSession(input: {
  apiOrigin: string;
  accessToken: string;
}): Promise<NativeNaverAuthResult> {
  const response = await withTimeout(
    fetch(`${input.apiOrigin}/auth/naver/native`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        accessToken: input.accessToken,
      }),
    }),
    NATIVE_SESSION_EXCHANGE_TIMEOUT_MS,
    "NAVER_NATIVE_EXCHANGE_TIMEOUT"
  );

  if (!response.ok) {
    throw new Error(`NAVER_NATIVE_AUTH_HTTP_${response.status}`);
  }

  const parsed = (await response.json()) as {
    token?: unknown;
    userId?: unknown;
  };
  if (typeof parsed.token !== "string" || typeof parsed.userId !== "string") {
    throw new Error("NAVER_NATIVE_AUTH_INVALID_RESPONSE");
  }

  return {
    token: parsed.token,
    userId: parsed.userId,
  };
}

async function unlinkKakaoAccountWithTimeout() {
  return await withTimeout(unlinkKakao(), 10000, "KAKAO_NATIVE_UNLINK_TIMEOUT");
}

async function unlinkNaverAccountWithTimeout() {
  initializeNaverLoginSdk();
  return await withTimeout(NaverLogin.deleteToken(), 10000, "NAVER_NATIVE_UNLINK_TIMEOUT");
}
function readCallbackValue(url: URL, key: string) {
  const fromSearch = url.searchParams.get(key);
  if (fromSearch) {
    return fromSearch;
  }

  const hash = url.hash ?? "";
  const hashQueryIndex = hash.indexOf("?");
  if (hashQueryIndex >= 0) {
    const hashQuery = hash.slice(hashQueryIndex + 1);
    return new URLSearchParams(hashQuery).get(key);
  }

  return null;
}

function buildAuthCallbackHash(input: {
  token: string;
  userId?: string | null;
  provider?: AuthProvider | null;
  error?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("token", input.token);
  if (input.userId) {
    params.set("userId", input.userId);
  }
  if (input.provider) {
    params.set("provider", input.provider);
  }
  if (input.error) {
    params.set("error", input.error);
  }

  return `#/auth/callback?${params.toString()}`;
}

function resolveAuthCallbackHashFromUrl(rawUrl: string, nativeAppScheme: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const looksLikeAuthCallback =
      normalizeNativeAppScheme(parsed.protocol) === nativeAppScheme ||
      rawUrl.includes("/auth/callback") ||
      parsed.hash.includes("/auth/callback") ||
      (parsed.protocol === "file:" && parsed.pathname.endsWith("/index.html"));
    if (!looksLikeAuthCallback) {
      return null;
    }

    const token = readCallbackValue(parsed, "token");
    if (!token) {
      return null;
    }

    const userId = readCallbackValue(parsed, "userId");
    const rawProvider = readCallbackValue(parsed, "provider");
    const provider = rawProvider === "kakao" || rawProvider === "naver" ? rawProvider : null;
    const error = readCallbackValue(parsed, "error");

    return buildAuthCallbackHash({
      token,
      userId,
      provider,
      error,
    });
  } catch {
    return null;
  }
}

function resolveProviderFromBridgeLoginResultType(type: string): AuthProvider | null {
  if (type === "REST_AUTH_KAKAO_LOGIN_RESULT") {
    return "kakao";
  }
  if (type === "REST_AUTH_NAVER_LOGIN_RESULT") {
    return "naver";
  }
  return null;
}

async function hasSeenNativePermissionIntro(fileUri: string) {
  try {
    const info = await FileSystem.getInfoAsync(fileUri);
    return info.exists;
  } catch {
    return false;
  }
}

async function markNativePermissionIntroAsSeen(fileUri: string) {
  try {
    await FileSystem.writeAsStringAsync(
      fileUri,
      JSON.stringify({ seenAt: new Date().toISOString() }),
      { encoding: FileSystem.EncodingType.UTF8 }
    );
  } catch (error) {
    console.log("Failed to store native permission intro state:", error);
  }
}

function loadExpoLocationModule() {
  return ExpoLocation;
}

async function getLocationPermissionState(): Promise<NativePermissionState> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      if (result.granted || result.status === "granted") {
        return "granted";
      }
      if (result.status === "denied") {
        return "denied";
      }
      return "undetermined";
    } catch (error) {
      console.log("Failed to check location permission via expo-location:", error);
      return "undetermined";
    }
  }

  if (Platform.OS === "android") {
    try {
      const granted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return granted ? "granted" : "undetermined";
    } catch (error) {
      console.log("Failed to check Android location permission:", error);
      return "undetermined";
    }
  }

  return "undetermined";
}

async function requestLocationPermission(): Promise<boolean> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.requestForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.requestForegroundPermissionsAsync();
      return result.granted || result.status === "granted";
    } catch (error) {
      console.log("Failed to request location permission via expo-location:", error);
      return false;
    }
  }

  if (Platform.OS === "android") {
    try {
      const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.log("Failed to request Android location permission:", error);
      return false;
    }
  }

  const geolocation = (globalThis.navigator as { geolocation?: GeolocationLike } | undefined)?.geolocation;
  if (geolocation?.getCurrentPosition) {
    return await new Promise<boolean>((resolve) => {
      geolocation.getCurrentPosition(
        () => resolve(true),
        () => resolve(false),
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
      );
    });
  }

  return false;
}

async function getLocationPermissionSnapshot(): Promise<LocationPermissionSnapshot> {
  const expoLocation = loadExpoLocationModule();
  if (expoLocation?.getForegroundPermissionsAsync) {
    try {
      const result = await expoLocation.getForegroundPermissionsAsync();
      const granted = Boolean(result.granted || result.status === "granted");
      const status: NativePermissionState =
        result.status === "granted" ? "granted" : result.status === "denied" ? "denied" : "undetermined";
      const canAskAgainFromResult = (result as { canAskAgain?: boolean }).canAskAgain;
      return {
        granted,
        canAskAgain:
          typeof canAskAgainFromResult === "boolean" ? canAskAgainFromResult : status !== "denied",
        status,
      };
    } catch (error) {
      console.log("Failed to read location permission snapshot via expo-location:", error);
    }
  }

  const status = await getLocationPermissionState();
  return {
    granted: status === "granted",
    canAskAgain: status !== "denied",
    status,
  };
}

async function getCurrentLocationCoordinates(): Promise<NativeCoordinates | null> {
  const expoLocation = loadExpoLocationModule() as {
    getCurrentPositionAsync?: (options?: {
      accuracy?: number;
      timeout?: number;
      maximumAge?: number;
    }) => Promise<{ coords?: { latitude?: number; longitude?: number } }>;
  } | null;

  if (expoLocation?.getCurrentPositionAsync) {
    try {
      const result = await expoLocation.getCurrentPositionAsync({
        timeout: 8000,
      });
      const latitude = result?.coords?.latitude;
      const longitude = result?.coords?.longitude;
      if (typeof latitude === "number" && typeof longitude === "number") {
        return { latitude, longitude };
      }
    } catch (error) {
      console.log("Failed to read current position via expo-location:", error);
    }
  }

  const geolocation = (globalThis.navigator as { geolocation?: GeolocationLike } | undefined)?.geolocation;
  if (!geolocation?.getCurrentPosition) {
    return null;
  }

  return await new Promise<NativeCoordinates | null>((resolve) => {
    geolocation.getCurrentPosition(
      (position) => {
        const latitude = position?.coords?.latitude;
        const longitude = position?.coords?.longitude;
        if (typeof latitude === "number" && typeof longitude === "number") {
          resolve({ latitude, longitude });
          return;
        }
        resolve(null);
      },
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 5 * 60 * 1000 }
    );
  });
}

async function getLocationCoordinatesSnapshot(): Promise<LocationCoordinatesSnapshot> {
  const permission = await getLocationPermissionSnapshot();
  if (!permission.granted) {
    return {
      ...permission,
      coordinates: null,
    };
  }

  const coordinates = await getCurrentLocationCoordinates();
  return {
    ...permission,
    coordinates,
  };
}

async function fetchNativeWeatherSnapshot(): Promise<NativeWeatherSnapshot | null> {
  const locationSnapshot = await getLocationCoordinatesSnapshot();
  if (!locationSnapshot.granted || !locationSnapshot.coordinates) {
    return null;
  }
  const coordinates = locationSnapshot.coordinates;

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(coordinates.latitude));
  url.searchParams.set("longitude", String(coordinates.longitude));
  url.searchParams.set("current", "temperature_2m,weather_code,is_day");
  url.searchParams.set("forecast_days", "1");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Open-Meteo weather API error: ${response.status}`);
  }

  const data = (await response.json()) as {
    current?: { temperature_2m?: number; weather_code?: number; is_day?: number };
  };
  const current = data.current;
  if (
    !current ||
    typeof current.temperature_2m !== "number" ||
    typeof current.weather_code !== "number" ||
    typeof current.is_day !== "number"
  ) {
    throw new Error("Invalid Open-Meteo weather payload");
  }

  return {
    temperature: current.temperature_2m,
    weatherCode: current.weather_code,
    isDay: current.is_day,
    coordinates,
    source: "device",
    updatedAt: new Date().toISOString(),
  };
}

function FocusLaunchOverlay({
  statusMessage,
  progressPercent,
}: {
  statusMessage: string;
  progressPercent: number;
}) {
  const sweepProgress = useRef(new Animated.Value(0)).current;
  const checkProgress = useRef(new Animated.Value(0)).current;
  const pulseOpacity = useRef(new Animated.Value(0.88)).current;
  const progressWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressWidth, {
      toValue: (LAUNCH_PROGRESS_BAR_WIDTH * Math.max(0, Math.min(progressPercent, 100))) / 100,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [progressPercent, progressWidth]);

  useEffect(() => {
    const animationLoop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(sweepProgress, {
            toValue: 1,
            duration: LAUNCH_ANIMATION_RING_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: LAUNCH_ANIMATION_RING_DURATION_MS / 2,
            easing: Easing.inOut(Easing.quad),
            useNativeDriver: true,
          }),
        ]),
        Animated.timing(checkProgress, {
          toValue: 1,
          duration: LAUNCH_ANIMATION_CHECK_DURATION_MS,
          easing: Easing.out(Easing.back(1.6)),
          useNativeDriver: true,
        }),
        Animated.delay(LAUNCH_ANIMATION_PAUSE_MS),
        Animated.parallel([
          Animated.timing(sweepProgress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(checkProgress, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.88,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    animationLoop.start();
    return () => {
      animationLoop.stop();
    };
  }, [checkProgress, pulseOpacity, sweepProgress]);

  const ringRotate = sweepProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ["-90deg", "270deg"],
  });

  const checkOpacity = checkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const checkScale = checkProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.72, 1],
  });

  return (
    <View style={styles.launchOverlay}>
      <Animated.View style={[styles.launchBadge, { opacity: pulseOpacity }]}>
        <View style={styles.launchRingTrack} />
        <Animated.View
          style={[
            styles.launchRingSweep,
            {
              transform: [{ rotate: ringRotate }],
            },
          ]}
        />
        <View style={styles.launchCheckWrap}>
        <Animated.View
          style={[
            styles.launchCheckIconWrap,
            {
              opacity: checkOpacity,
              transform: [{ scale: checkScale }],
            },
          ]}
        >
          <Feather name="check" size={52} color="#F8FAFC" />
        </Animated.View>
        </View>
      </Animated.View>
      <View style={styles.launchProgressWrap}>
        <View style={styles.launchProgressTrack}>
          <Animated.View style={[styles.launchProgressFill, { width: progressWidth }]} />
        </View>
      </View>
      <Text style={styles.launchStatusText}>{statusMessage}</Text>
    </View>
  );
}


export default function WebViewScreen() {
  const pendingNotificationPathRef = useRef<string | null>(null);
  const pendingAuthCallbackHashRef = useRef<string | null>(null);
  const isWebViewReadyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isExternalNavigation, setIsExternalNavigation] = useState(false);
  const [isPermissionIntroReady, setIsPermissionIntroReady] = useState(false);
  const [isPermissionIntroVisible, setIsPermissionIntroVisible] = useState(false);
  const [isRequestingNotificationPermission, setIsRequestingNotificationPermission] = useState(false);
  const [isNativeUpdateRequired, setIsNativeUpdateRequired] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const nativeTodoViewRef = useRef<NativeTodoViewSnapshot>({
    isViewingTodayTodoSurface: false,
    source: "none",
    dateKey: null,
    routePath: null,
  });
  const pendingWeatherSnapshotRef = useRef<NativeWeatherSnapshot | null>(null);
  const hasShownFatalStartupAlertRef = useRef(false);
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [webUiEntryUri, setWebUiEntryUri] = useState<string | null>(null);
  const [webViewUri, setWebViewUri] = useState<string | null>(null);
  const nativeAppScheme = useMemo(() => resolveNativeAppScheme(), []);

  const navigateWebViewToAuthCallbackHash = useCallback(
    (callbackHash: string) => {
      const activeEntryUri = webUiEntryUri ?? localFileUri;
      const normalizedHash = callbackHash.startsWith("#") ? callbackHash : `#${callbackHash}`;
      if (!activeEntryUri) {
        pendingAuthCallbackHashRef.current = normalizedHash;
        return false;
      }

      pendingAuthCallbackHashRef.current = null;
      if (webViewRef.current && isWebViewReadyRef.current) {
        webViewRef.current.injectJavaScript(
          `(() => { window.location.hash = ${JSON.stringify(normalizedHash)}; })(); true;`
        );
        return true;
      }

      const nextUri = buildWebUiUriWithHash(activeEntryUri, normalizedHash);
      setWebViewUri((prev) => (prev === nextUri ? prev : nextUri));
      return true;
    },
    [localFileUri, webUiEntryUri]
  );

  const navigateWebViewByTargetPath = (targetPath: string) => {
    if (!targetPath.startsWith("/")) {
      return;
    }

    const resolvedTargetPath =
      nativeTodoViewRef.current.source === "date-tasks"
        ? convertCalendarSheetPathToDateTasksPath(targetPath)
        : targetPath;
    const hashPath = `#${resolvedTargetPath}`;
    pendingNotificationPathRef.current = resolvedTargetPath;

    if (!webViewRef.current || !isWebViewReadyRef.current) {
      if (webUiEntryUri) {
        const nextUri = buildWebUiUriWithHash(webUiEntryUri, hashPath);
        setWebViewUri((prev) => (prev === nextUri ? prev : nextUri));
      }
      return;
    }

    webViewRef.current.injectJavaScript(
      `(() => { window.location.hash = ${JSON.stringify(hashPath)}; })(); true;`
    );
    pendingNotificationPathRef.current = null;
  };

  const dispatchNativeBridgeEvent = useCallback(
    (message: { type: string; payload?: Record<string, unknown> }) => {
      if (!webViewRef.current || !isWebViewReadyRef.current) {
        return false;
      }

      const bridgeMessage = JSON.stringify(message);
      webViewRef.current.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${bridgeMessage} })); true;`
      );
      return true;
    },
    []
  );
  const sendBridgeResult = useCallback(
    (message: { type: string; requestId?: string | null; payload?: unknown }) => {
      const loginProvider = resolveProviderFromBridgeLoginResultType(message.type);
      const payload = readUnknownRecord(message.payload);
      const token = readUnknownString(payload?.token);
      const userId = readUnknownString(payload?.userId);
      const authCallbackHash =
        loginProvider && token
          ? buildAuthCallbackHash({
              token,
              userId: userId || null,
              provider: loginProvider,
            })
          : null;

      if (!webViewRef.current) {
        if (authCallbackHash) {
          navigateWebViewToAuthCallbackHash(authCallbackHash);
        }
        return;
      }

      const bridgeMessage = JSON.stringify(message);
      const fallbackAuthCallbackHash = JSON.stringify(authCallbackHash);
      webViewRef.current.injectJavaScript(
        `(() => {
          const initialHash = window.location.hash;
          window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${bridgeMessage} }));
          const fallbackHash = ${fallbackAuthCallbackHash};
          if (fallbackHash) {
            window.setTimeout(() => {
              const currentHash = window.location.hash || '';
              if (currentHash === initialHash || currentHash.includes('/login')) {
                window.location.hash = fallbackHash;
              }
            }, 300);
          }
        })(); true;`
      );
    },
    [navigateWebViewToAuthCallbackHash]
  );

  const dispatchPendingWeatherSnapshot = useCallback(() => {
    const pendingSnapshot = pendingWeatherSnapshotRef.current;
    if (!pendingSnapshot) {
      return;
    }

    const isDispatched = dispatchNativeBridgeEvent({
      type: "RN_WEATHER_SNAPSHOT",
      payload: pendingSnapshot as unknown as Record<string, unknown>,
    });
    if (isDispatched) {
      pendingWeatherSnapshotRef.current = null;
    }
  }, [dispatchNativeBridgeEvent]);

  const shouldInlineTodoPromptInForeground = useCallback(
    (targetPath: string, promptType: "start_todo" | "focus_target_elapsed") => {
    const view = nativeTodoViewRef.current;
    if (!view.isViewingTodayTodoSurface) {
      return false;
    }

    try {
      const rawSearch = targetPath.split("?", 2)[1] ?? "";
      const params = new URLSearchParams(rawSearch);
      const targetDateKey = params.get("date") ?? formatLocalDateKey(new Date());
      if (targetDateKey !== formatLocalDateKey(new Date())) {
        return false;
      }

      if (promptType === "start_todo") {
        return params.get("startTodoPrompt") === "1";
      }

      return params.get("focusTargetElapsed") === "1";
    } catch {
      return false;
    }
  }, []);

  const handleTodoViewSync = useCallback((payload: TodoViewSyncPayload) => {
    const source =
      payload.source === "date-tasks" || payload.source === "calendar-sheet" || payload.source === "none"
        ? payload.source
        : "none";
    nativeTodoViewRef.current = {
      isViewingTodayTodoSurface: Boolean(payload.isViewingTodayTodoSurface),
      source,
      dateKey: typeof payload.dateKey === "string" ? payload.dateKey : null,
      routePath: typeof payload.routePath === "string" ? payload.routePath : null,
    };
  }, []);

  const {
    handleRestNotificationBridgeMessage,
    requestRestNotificationPermission,
    getRestNotificationPermissionSnapshot,
    getRestExpoPushTokenSnapshot,
  } = useRestNotificationBridge({
    onNavigate: navigateWebViewByTargetPath,
    shouldInlineTodoPromptInForeground,
  });
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const [launchStatusMessage, setLaunchStatusMessage] = useState<WebUiVersionProgress>(
    "초기 번들 준비중..."
  );
  const [hasInitialWebViewLoaded, setHasInitialWebViewLoaded] = useState(false);
  const [hasLaunchOverlayMinElapsed, setHasLaunchOverlayMinElapsed] = useState(false);
  const { width, fontScale } = useWindowDimensions();
  const safeAreaInsets = useSafeAreaInsets();
  const hybridApiOrigin = useMemo(() => resolveHybridApiOrigin(), []);
  const webUiReleaseChannel = useMemo(
    () =>
      resolveWebUiReleaseChannel({
        explicitChannel: process.env.EXPO_PUBLIC_WEBUI_CHANNEL,
        isDev: __DEV__,
      }),
    []
  );
  const webUiManifestUrl = useMemo(
    () =>
      resolveWebUiManifestUrl({
        channel: webUiReleaseChannel,
        manifestUrl: process.env.EXPO_PUBLIC_WEBUI_MANIFEST_URL,
      }),
    [webUiReleaseChannel]
  );

  const uiScale = useMemo(() => {
    const effectiveWidth = width / clamp(fontScale, 1, 1.2);
    const rawScale = effectiveWidth / BASE_WIDTH;
    return clamp(rawScale, MIN_SCALE, MAX_SCALE);
  }, [fontScale, width]);
  const nativeSafeAreaBottomPx = Math.max(0, Math.round(safeAreaInsets.bottom));
  const nativeSafeAreaTopPx = Math.max(0, Math.round(safeAreaInsets.top));

  const calendarLayoutVars = useMemo(() => {
    const normalizedFontScale = clamp(fontScale, 1, 1.2);
    const effectiveWidth = width / normalizedFontScale;
    const estimatedCellWidthPx = effectiveWidth / 7;
    const iconSizePx = Math.round(clamp(estimatedCellWidthPx * 0.12, 6, 8));
    const iconPaddingPx = 1;
    const iconGapPx = 1;
    const iconCircleWidthPx = iconSizePx + iconPaddingPx * 2 + 2;
    const iconSlotSingleWidthPx = Math.round(clamp(iconCircleWidthPx + 1, 9, 12));
    const iconSlotDoubleWidthPx = Math.round(clamp(iconCircleWidthPx * 2 + iconGapPx + 1, 18, 24));
    const cellMinHeightRem = 0;
    const topRowHeightRem = clamp(1.08 + (normalizedFontScale - 1) * 0.24, 1.08, 1.24);
    const numberFontRem = clamp(estimatedCellWidthPx / 66, 0.74, 0.9);
    const dateSlotWidthCh = estimatedCellWidthPx < 46 ? 1.75 : 2;

    return {
      iconSizePx,
      iconPaddingPx,
      iconGapPx,
      iconSlotSingleWidthPx,
      iconSlotDoubleWidthPx,
      dateSlotWidthCh,
      cellMinHeightRem,
      topRowHeightRem,
      numberFontRem,
    };
  }, [fontScale, width]);

  const applyScaleScript = useMemo(
    () =>
      `(() => {
        if (window.location.protocol !== 'file:') {
          return true;
        }
        const root = document.documentElement;
        root.style.setProperty('--ui-scale', '${uiScale.toFixed(3)}');
        root.style.setProperty('--native-safe-area-inset-bottom', '${nativeSafeAreaBottomPx}px');
        root.style.setProperty('--native-safe-area-inset-top', '${nativeSafeAreaTopPx}px');
        root.style.setProperty('--calendar-cell-min-h', '${calendarLayoutVars.cellMinHeightRem.toFixed(
          3
        )}rem');
        root.style.setProperty('--calendar-top-row-h', '${calendarLayoutVars.topRowHeightRem.toFixed(3)}rem');
        root.style.setProperty('--calendar-icon-size', '${calendarLayoutVars.iconSizePx}px');
        root.style.setProperty('--calendar-icon-padding', '${calendarLayoutVars.iconPaddingPx}px');
        root.style.setProperty('--calendar-icon-gap', '${calendarLayoutVars.iconGapPx}px');
        root.style.setProperty('--calendar-icon-slot-single-w', '${
          calendarLayoutVars.iconSlotSingleWidthPx
        }px');
        root.style.setProperty('--calendar-icon-slot-double-w', '${
          calendarLayoutVars.iconSlotDoubleWidthPx
        }px');
        root.style.setProperty('--calendar-date-slot-w', '${calendarLayoutVars.dateSlotWidthCh.toFixed(
          2
        )}ch');
        root.style.setProperty('--calendar-date-number-size', '${calendarLayoutVars.numberFontRem.toFixed(
          3
        )}rem');
        root.style.background = 'transparent';
        if (document.body) {
          document.body.style.background = 'transparent';
        }
        const styleId = 'native-transparent-weather-background';
        if (!document.getElementById(styleId)) {
          const styleEl = document.createElement('style');
          styleEl.id = styleId;
          styleEl.textContent = [
            'html, body, #root, #app, #__next, main { background: transparent !important; }',
            '#root > div, #app > div, #__next > div, main > div { background: transparent !important; }',
            'body::before, body::after, #root::before, #root::after { background: transparent !important; }',
          ].join('\\n');
          document.head?.appendChild(styleEl);
        }
      })(); true;`,
    [calendarLayoutVars, nativeSafeAreaBottomPx, nativeSafeAreaTopPx, uiScale]
  );
  const webDebugBridgeScript = useMemo(
    () => `(() => {
      const post = (type, payload) => {
        try {
          window.ReactNativeWebView?.postMessage(JSON.stringify({ __wvDebug: true, type, payload }));
        } catch {}
      };
      window.addEventListener('error', (event) => {
        post('window-error', {
          message: event?.message,
          filename: event?.filename,
          lineno: event?.lineno,
          colno: event?.colno,
        });
      });
      window.addEventListener('unhandledrejection', (event) => {
        post('unhandledrejection', {
          reason:
            typeof event?.reason === 'string'
              ? event.reason
              : event?.reason?.message || String(event?.reason),
        });
      });
      const wrap = (level) => {
        const original = console[level];
        console[level] = (...args) => {
          post('console-' + level, {
            args: args.map((arg) => {
              if (typeof arg === 'string') return arg;
              try {
                return JSON.stringify(arg);
              } catch {
                return String(arg);
              }
            }),
          });
          original?.apply(console, args);
        };
      };
      wrap('log');
      wrap('warn');
      wrap('error');
      window.__HYBRID_API_ORIGIN__ = ${JSON.stringify(hybridApiOrigin)};
      window.__HYBRID_APP_SCHEME__ = ${JSON.stringify(nativeAppScheme)};
      post('bridge-ready', { href: location.href, appScheme: window.__HYBRID_APP_SCHEME__ });
    })(); true;`,
    [hybridApiOrigin, nativeAppScheme]
  );
  const injectedBeforeContentLoaded = useMemo(
    () => `${webDebugBridgeScript}\n${applyScaleScript}`,
    [webDebugBridgeScript, applyScaleScript]
  );

  const refreshNativeWeatherSnapshot = useCallback(async () => {
    try {
      const snapshot = await fetchNativeWeatherSnapshot();
      if (!snapshot) {
        pendingWeatherSnapshotRef.current = null;
        dispatchNativeBridgeEvent({ type: "RN_WEATHER_SNAPSHOT", payload: {} });
        return;
      }
      pendingWeatherSnapshotRef.current = snapshot;
      dispatchPendingWeatherSnapshot();
    } catch (error) {
      console.log("Failed to fetch native weather snapshot:", error);
    }
  }, [dispatchNativeBridgeEvent, dispatchPendingWeatherSnapshot]);

  useEffect(() => {
    let cancelled = false;

    const loadNativeWeather = async () => {
      await refreshNativeWeatherSnapshot();
      if (cancelled) {
        return;
      }
    };

    void loadNativeWeather();
    const intervalId = setInterval(() => {
      void loadNativeWeather();
    }, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [refreshNativeWeatherSnapshot]);

  useEffect(() => {
    // 권한 인트로는 앱 첫 진입 시점에서 노출
    let cancelled = false;
    const showPermissionIntroIfNeeded = async () => {
      try {
        const hasSeenIntro = await hasSeenNativePermissionIntro(NOTIFICATION_PERMISSION_INTRO_FILE_URI);
        if (cancelled) {
          return;
        }
        if (!hasSeenIntro) {
          setIsPermissionIntroVisible(true);
        }
      } catch (error) {
        console.log("Failed to initialize notification permission intro after login:", error);
        if (!cancelled) {
          setIsPermissionIntroVisible(true);
        }
      } finally {
        if (!cancelled) {
          setIsPermissionIntroReady(true);
        }
      }
    };

    void showPermissionIntroIfNeeded();
    return () => {
      cancelled = true;
    };
  }, []);

  const completePermissionIntro = async () => {
    await markNativePermissionIntroAsSeen(NOTIFICATION_PERMISSION_INTRO_FILE_URI);
    setIsPermissionIntroVisible(false);
  };

  const handleRequestNotificationPermission = async () => {
    setIsRequestingNotificationPermission(true);
    try {
      await requestRestNotificationPermission();
    } catch (error) {
      console.log("Failed to request notification permission from intro screen:", error);
    } finally {
      await completePermissionIntro();
      setIsRequestingNotificationPermission(false);
    }
  };

  useEffect(() => {
    const prepareLocalHtmlFile = async () => {
      try {
        setLaunchStatusMessage("초기 번들 준비중...");
        const nativeAppVersion = resolveNativeAppVersion() ?? "1.0.0";
        const prepared = await prepareWebUiBundleVersion({
          embeddedFiles: embeddedWebUiFiles,
          releaseChannel: webUiReleaseChannel,
          manifestUrl: webUiManifestUrl,
          fallbackCurrentVersion: nativeAppVersion,
          nativeAppVersion,
          nativePlatform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
          onProgress: setLaunchStatusMessage,
        });

        console.log("Prepared local web-ui file:", prepared.localIndexUri);
        setLocalFileUri(prepared.localIndexUri);
        setWebUiEntryUri(prepared.entryUri);
        setWebViewUri(prepared.entryUri);
      } catch (error) {
        console.log("Failed to prepare local web-ui file:", error);
        if (!hasShownFatalStartupAlertRef.current) {
          hasShownFatalStartupAlertRef.current = true;
          if (isNativeVersionUnsupportedStartupError(error)) {
            setIsNativeUpdateRequired(true);
          } else {
            showWebUiStartupErrorAlert(error);
          }
        }
      } finally {
        setIsPreparingLocalFile(false);
      }
    };

    prepareLocalHtmlFile();
  }, [webUiManifestUrl, webUiReleaseChannel]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (webViewRef.current && canGoBack) {
        webViewRef.current.goBack();
        return true;
      }
      return false;
    });

    return () => {
      subscription.remove();
    };
  }, [canGoBack]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const previousState = appStateRef.current;
      appStateRef.current = nextState;

      if (previousState === nextState) {
        return;
      }

      dispatchNativeBridgeEvent({
        type: "RN_APP_STATE_CHANGED",
        payload: {
          state: nextState,
          previousState,
          isActive: nextState === "active",
        },
      });

    });

    return () => {
      subscription.remove();
    };
  }, [dispatchNativeBridgeEvent]);

  useEffect(() => {
    const callbackHash = pendingAuthCallbackHashRef.current;
    if (!callbackHash) {
      return;
    }

    navigateWebViewToAuthCallbackHash(callbackHash);
  }, [localFileUri, navigateWebViewToAuthCallbackHash, webUiEntryUri]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const callbackHash = resolveAuthCallbackHashFromUrl(event.url, nativeAppScheme);
      if (!callbackHash) {
        return;
      }

      navigateWebViewToAuthCallbackHash(callbackHash);
    };

    const subscription = Linking.addEventListener("url", handleDeepLink);
    void Linking.getInitialURL()
      .then((url) => {
        if (url) {
          handleDeepLink({ url });
        }
      })
      .catch((error) => {
        console.log("Failed to read initial auth callback URL:", error);
      });

    return () => {
      subscription.remove();
    };
  }, [nativeAppScheme, navigateWebViewToAuthCallbackHash]);

  useEffect(() => {
    if (!webUiEntryUri || !webViewRef.current) {
      return;
    }

    if (!webViewUri) {
      setWebViewUri(webUiEntryUri);
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [webUiEntryUri, webViewUri, applyScaleScript]);

  const source = webViewUri ? { uri: webViewUri } : null;
  const applyWeatherSettingsSync = useCallback(
    (payload: { enabled?: unknown; mood?: unknown; particleClarity?: unknown }) => {
      applyNativeWeatherSettings({
        enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
        mood: typeof payload.mood === "string" ? payload.mood : undefined,
        particleClarity: typeof payload.particleClarity === "number" ? payload.particleClarity : undefined,
      });
    },
    []
  );

  const handleMessage = async (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      if (parsedData?.__wvDebug) {
        console.log("[WebView debug]", parsedData.type, parsedData.payload);
        return;
      }
      const isHandledBridgeMessage = await routeWebViewBridgeMessage(parsedData, {
        sync: {
          handleTodoViewSync,
          applyWeatherSettingsSync,
          refreshNativeWeatherSnapshot,
        },
        notification: {
          sendBridgeResult,
          requestRestNotificationPermission: async () => {
            await requestRestNotificationPermission();
          },
          getRestNotificationPermissionSnapshot,
          getRestExpoPushTokenSnapshot,
          openAppSettings: async () => {
            await Linking.openSettings().catch((error) => {
              console.log("Failed to open settings from web bridge:", error);
            });
          },
        },
        location: {
          sendBridgeResult,
          getLocationPermissionSnapshot,
          requestLocationPermission,
          getLocationCoordinatesSnapshot,
        },
        version: {
          sendBridgeResult,
          getNativeAppVersion: resolveNativeAppVersion,
          getStoredWebUiReleaseSnapshot: readStoredWebUiReleaseSnapshot,
          webUiReleaseChannel,
          platform: Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown",
        },
        auth: {
          sendBridgeResult,
          hybridApiOrigin,
          requestNativeNaverAccessToken,
          requestNativeKakaoOAuthToken,
          exchangeNaverAccessTokenForSession,
          exchangeKakaoAccessTokenForSession,
          unlinkNaverAccountWithTimeout,
          unlinkKakaoAccountWithTimeout,
          resolveNativeErrorCode,
        },
      });
      if (isHandledBridgeMessage) {
        return;
      }

      const isHandledNotificationBridgeMessage = await handleRestNotificationBridgeMessage(parsedData);
      if (isHandledNotificationBridgeMessage) {
        return;
      }
      console.log("Message from web-ui:", parsedData);
    } catch (error) {
      console.log("Failed to parse web message:", data, error);
      console.log("[WebView raw message]", data);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasLaunchOverlayMinElapsed(true);
    }, LAUNCH_OVERLAY_MIN_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const showPermissionIntro = !isNativeUpdateRequired && isPermissionIntroReady && isPermissionIntroVisible;
  const isLaunchDestinationReady = isNativeUpdateRequired || showPermissionIntro || hasInitialWebViewLoaded;
  const launchProgressPercent = useMemo(
    () => resolveLaunchProgressPercent(launchStatusMessage),
    [launchStatusMessage]
  );
  const shouldShowLaunchOverlay =
    FORCE_LAUNCH_OVERLAY_FOR_TEST ||
    isPreparingLocalFile ||
    !hasLaunchOverlayMinElapsed ||
    !isLaunchDestinationReady;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {shouldShowLaunchOverlay ? (
        <FocusLaunchOverlay statusMessage={launchStatusMessage} progressPercent={launchProgressPercent} />
      ) : null}
      {source && !showPermissionIntro && !isNativeUpdateRequired ? (
        <View style={styles.webViewContainer}>
          <View
            pointerEvents="none"
            style={styles.weatherLayer}>
            <NativeWeatherLayer />
          </View>
	          <WebView
            ref={webViewRef}
            style={styles.webView}
            source={source}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            allowsBackForwardNavigationGestures={isExternalNavigation}
            bounces={false}
            overScrollMode="never"
            injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoaded}
            allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            onShouldStartLoadWithRequest={(request) => {
              console.log("WebView should start request:", request.url);

              if (hasNativeAppProtocol(request.url, nativeAppScheme)) {
                const callbackHash = resolveAuthCallbackHashFromUrl(request.url, nativeAppScheme);
                if (callbackHash) {
                  navigateWebViewToAuthCallbackHash(callbackHash);
                }
                return false;
              }

              if (request.url.includes("#/auth/callback") && request.url.includes("token=")) {
                return true;
              }

              const callbackHash = resolveAuthCallbackHashFromUrl(request.url, nativeAppScheme);
              if (!callbackHash) {
                return true;
              }

              navigateWebViewToAuthCallbackHash(callbackHash);
              return false;
            }}
            onLoadStart={() => {
              console.log("WebView load start:", source?.uri);
              isWebViewReadyRef.current = false;
            }}
            onLoadEnd={() => {
              console.log("WebView load end:", source?.uri);
              isWebViewReadyRef.current = true;
              setHasInitialWebViewLoaded(true);
              if (webViewRef.current) {
                webViewRef.current.injectJavaScript(applyScaleScript);
              }
              dispatchPendingWeatherSnapshot();
              const pendingTargetPath = pendingNotificationPathRef.current;
              if (pendingTargetPath) {
                const hashPath = `#${pendingTargetPath}`;
                webViewRef.current?.injectJavaScript(
                  `(() => { window.location.hash = ${JSON.stringify(hashPath)}; })(); true;`
                );
                pendingNotificationPathRef.current = null;
              }
            }}
            onLoadProgress={(event) => {
              console.log("WebView load progress:", event.nativeEvent.progress);
            }}
            onNavigationStateChange={(navState) => {
              setCanGoBack(navState.canGoBack);
              const nextUrl = navState.url ?? "";
              setIsExternalNavigation(!nextUrl.startsWith("file://"));
              nativeTodoViewRef.current = parseTodoViewSnapshotFromWebViewUrl(nextUrl);
            }}
            onMessage={handleMessage}
            onHttpError={(event) => {
              console.log("WebView HTTP error:", event.nativeEvent.statusCode, event.nativeEvent.description);
              setHasInitialWebViewLoaded(true);
            }}
            onContentProcessDidTerminate={() => {
              console.log("WebView content process terminated");
              setHasInitialWebViewLoaded(true);
            }}
            onError={(event) => {
              const msg = event.nativeEvent.description || "Unknown WebView error";
              const callbackHash = resolveAuthCallbackHashFromUrl(
                event.nativeEvent.url ?? "",
                nativeAppScheme
              );
              if (callbackHash) {
                navigateWebViewToAuthCallbackHash(callbackHash);
                return;
              }
              console.log("WebView error:", msg);
              setHasInitialWebViewLoaded(true);
              Alert.alert("WebView Error", msg);
            }}
	          />
	        </View>
	      ) : null}
      {showPermissionIntro ? (
        <PermissionIntroModal
          isRequestingNotificationPermission={isRequestingNotificationPermission}
          onRequestNotificationPermission={handleRequestNotificationPermission}
        />
      ) : null}
      {isNativeUpdateRequired ? (
        <NativeUpdateRequiredModal
          onUpdatePress={() => {
            void openNativeAppMarket().catch((openError) => {
              console.log("Failed to open app market:", openError);
            });
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B1220",
  },
  launchOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    backgroundColor: "#0B1220",
    alignItems: "center",
    justifyContent: "center",
  },
  launchBadge: {
    width: 164,
    height: 164,
    borderRadius: 48,
    backgroundColor: "#0F172A",
    alignItems: "center",
    justifyContent: "center",
  },
  launchRingTrack: {
    position: "absolute",
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 8,
    borderColor: "rgba(44, 230, 166, 0.2)",
  },
  launchRingSweep: {
    position: "absolute",
    width: 106,
    height: 106,
    borderRadius: 53,
    borderWidth: 8,
    borderTopColor: "#2CE6A6",
    borderRightColor: "#2CE6A6",
    borderBottomColor: "transparent",
    borderLeftColor: "transparent",
  },
  launchCheckWrap: {
    position: "absolute",
    width: 74,
    height: 74,
    left: 45,
    top: 45,
    alignItems: "center",
    justifyContent: "center",
  },
  launchCheckIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  launchStatusText: {
    marginTop: 14,
    color: "rgba(226, 232, 240, 0.96)",
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.2,
  },
  launchProgressWrap: {
    marginTop: 18,
    width: LAUNCH_PROGRESS_BAR_WIDTH,
    alignItems: "flex-start",
  },
  launchProgressTrack: {
    width: LAUNCH_PROGRESS_BAR_WIDTH,
    height: 6,
    borderRadius: 99,
    backgroundColor: "rgba(148, 163, 184, 0.24)",
    overflow: "hidden",
  },
  launchProgressFill: {
    height: "100%",
    borderRadius: 99,
    backgroundColor: "#2CE6A6",
  },
  webViewContainer: {
    flex: 1,
    backgroundColor: "transparent",
  },
  weatherLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 2,
  },
  webView: {
    flex: 1,
    backgroundColor: "transparent",
    zIndex: 1,
  },
});
