import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
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
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  readNativeTodoSession,
  type NativeTodoSession,
  writeNativeTodoSession,
} from "../src/features/todo/nativeTodoSessionStorage";
import {
  applyNativeWeatherSettings,
  NativeWeatherLayer,
} from "../src/features/weather/components/NativeWeatherLayer";
import { routeWebViewBridgeMessage } from "../src/features/bridge/routeWebViewBridgeMessage";
import type { TodoSessionSyncPayload } from "../src/features/bridge/handlers/syncBridgeHandlers";
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
const NOTIFICATION_PERMISSION_INTRO_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""
}native-notification-permission-intro-v1.json`;
const LAUNCH_ANIMATION_RING_DURATION_MS = 900;
const LAUNCH_ANIMATION_CHECK_DURATION_MS = 280;
const LAUNCH_ANIMATION_PAUSE_MS = 280;
const LAUNCH_OVERLAY_MIN_VISIBLE_MS = 800;
const LAUNCH_PROGRESS_BAR_WIDTH = 196;
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

type TodoSessionRecoveryPayload = {
  dateKey: string;
  todoId: string;
  startedAt: string;
  sessionId: string;
  backgroundEnteredAtMs: number;
  resumedAtMs: number;
  elapsedSeconds: number;
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
type DeviceLockStatePayload = {
  isLocked?: boolean;
};
type DeviceLockStateSnapshot = {
  isLocked?: boolean;
};
type DeviceLockEventNativeModule = {
  getCurrentLockState?: () => Promise<DeviceLockStateSnapshot>;
  addListener?: (eventName: string) => void;
  removeListeners?: (count: number) => void;
};
type NativeEventEmitterModuleShape = {
  addListener: (eventType: string) => void;
  removeListeners: (count: number) => void;
};
const NAVER_NATIVE_CONSUMER_KEY = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim() ?? "";
const NAVER_NATIVE_CONSUMER_SECRET = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim() ?? "";
const NAVER_NATIVE_URL_SCHEME = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim() ?? "";
const NAVER_NATIVE_APP_NAME =
  process.env.EXPO_PUBLIC_NAVER_APP_NAME?.trim() ??
  (Constants.expoConfig?.name?.trim() || "focus-hybrid");
const NAVER_DISABLE_APP_AUTH_IOS = process.env.EXPO_PUBLIC_NAVER_DISABLE_APP_AUTH_IOS === "true";
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
    return await withTimeout(loginWithKakaoTalk(), 25000, "KAKAO_NATIVE_TALK_LOGIN_TIMEOUT");
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
    25000,
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
    12000,
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
    12000,
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

function resolveAuthCallbackHashFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const looksLikeAuthCallback =
      parsed.protocol === "mobile:" ||
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
    const error = readCallbackValue(parsed, "error");
    const params = new URLSearchParams();
    params.set("token", token);
    if (userId) {
      params.set("userId", userId);
    }
    if (error) {
      params.set("error", error);
    }

    return `#/auth/callback?${params.toString()}`;
  } catch {
    return null;
  }
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
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const loadedModule = require("expo-location") as {
      getForegroundPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
      requestForegroundPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
    };
    return loadedModule;
  } catch {
    return null;
  }
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
  const isWebViewReadyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isExternalNavigation, setIsExternalNavigation] = useState(false);
  const [isPermissionIntroReady, setIsPermissionIntroReady] = useState(false);
  const [isPermissionIntroVisible, setIsPermissionIntroVisible] = useState(false);
  const [isRequestingNotificationPermission, setIsRequestingNotificationPermission] = useState(false);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const nativeTodoSessionRef = useRef<NativeTodoSession | null>(null);
  const pendingTodoSessionRecoveryRef = useRef<TodoSessionRecoveryPayload | null>(null);
  const pendingWeatherSnapshotRef = useRef<NativeWeatherSnapshot | null>(null);
  const isDeviceLockedRef = useRef(false);
  const skipNextForegroundDeviationRef = useRef(false);

  const navigateWebViewByTargetPath = (targetPath: string) => {
    if (!targetPath.startsWith("/")) {
      return;
    }

    const hashPath = `#${targetPath}`;
    pendingNotificationPathRef.current = targetPath;

    if (!webViewRef.current || !isWebViewReadyRef.current) {
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
      if (!webViewRef.current) {
        return;
      }
      webViewRef.current.injectJavaScript(
        `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
          message
        )} })); true;`
      );
    },
    []
  );

  const persistNativeTodoSession = useCallback(async (session: NativeTodoSession | null) => {
    nativeTodoSessionRef.current = session;
    await writeNativeTodoSession(session);
  }, []);

  const dispatchPendingTodoSessionRecovery = useCallback(async () => {
    const pending = pendingTodoSessionRecoveryRef.current;
    if (!pending || !isWebViewReadyRef.current) {
      return;
    }

    // RN -> WebView 복구 이벤트: 백그라운드 체류 시간(elapsedSeconds) 반영 요청
    dispatchNativeBridgeEvent({
      type: "RN_TODO_SESSION_RECOVERY",
      payload: pending,
    });
    pendingTodoSessionRecoveryRef.current = null;

    const current = nativeTodoSessionRef.current;
    if (current && current.sessionId === pending.sessionId && current.backgroundEnteredAtMs !== null) {
      await persistNativeTodoSession({
        ...current,
        backgroundEnteredAtMs: null,
      });
    }
  }, [dispatchNativeBridgeEvent, persistNativeTodoSession]);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      return;
    }

    const nativeModule = NativeModules.DeviceLockEventEmitter as DeviceLockEventNativeModule | undefined;
    if (!nativeModule) {
      return;
    }
    if (
      typeof nativeModule.addListener !== "function" ||
      typeof nativeModule.removeListeners !== "function"
    ) {
      return;
    }

    const applyLockState = (isLocked: boolean) => {
      console.log("[DeviceLock] RN applyLockState", { isLocked });
      isDeviceLockedRef.current = isLocked;
      if (isLocked) {
        skipNextForegroundDeviationRef.current = true;
      }

      dispatchNativeBridgeEvent({
        type: "RN_DEVICE_LOCK_STATE_CHANGED",
        payload: {
          isLocked,
          source: "ios-protected-data",
        },
      });
    };

    const eventEmitter = new NativeEventEmitter(nativeModule as NativeEventEmitterModuleShape);
    const subscription = eventEmitter.addListener(
      "DEVICE_LOCK_STATE_CHANGED",
      (payload: DeviceLockStatePayload | null | undefined) => {
        console.log("[DeviceLock] RN native event received", payload);
        applyLockState(Boolean(payload?.isLocked));
      }
    );

    void (async () => {
      try {
        const currentState = await nativeModule.getCurrentLockState?.();
        if (typeof currentState?.isLocked === "boolean") {
          console.log("[DeviceLock] RN initial native lock state", currentState);
          applyLockState(currentState.isLocked);
        }
      } catch (error) {
        console.log("Failed to read current iOS device lock state:", error);
      }
    })();

    return () => {
      subscription.remove();
    };
  }, [dispatchNativeBridgeEvent]);

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

  const {
    handleRestNotificationBridgeMessage,
    requestRestNotificationPermission,
    getRestNotificationPermissionSnapshot,
    getRestExpoPushTokenSnapshot,
  } = useRestNotificationBridge({
    onNavigate: navigateWebViewByTargetPath,
  });
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [webUiEntryUri, setWebUiEntryUri] = useState<string | null>(null);
  const [webViewUri, setWebViewUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const [launchStatusMessage, setLaunchStatusMessage] = useState<WebUiVersionProgress>(
    "초기 번들 준비중..."
  );
  const [hasInitialWebViewLoaded, setHasInitialWebViewLoaded] = useState(false);
  const [hasLaunchOverlayMinElapsed, setHasLaunchOverlayMinElapsed] = useState(false);
  const { width, fontScale } = useWindowDimensions();
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
        manifestUrlDev: process.env.EXPO_PUBLIC_WEBUI_MANIFEST_URL_DEV,
        manifestUrlProd: process.env.EXPO_PUBLIC_WEBUI_MANIFEST_URL_PROD,
        manifestUrlFallback: process.env.EXPO_PUBLIC_WEBUI_MANIFEST_URL,
      }),
    [webUiReleaseChannel]
  );

  const uiScale = useMemo(() => {
    const effectiveWidth = width / clamp(fontScale, 1, 1.2);
    const rawScale = effectiveWidth / BASE_WIDTH;
    return clamp(rawScale, MIN_SCALE, MAX_SCALE);
  }, [fontScale, width]);

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
    const cellMinHeightRem = clamp(5.15 + (normalizedFontScale - 1) * 0.75, 5.15, 5.8);
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
  }, [fontScale, uiScale]);

  const applyScaleScript = useMemo(
    () =>
      `(() => {
        if (window.location.protocol !== 'file:') {
          return true;
        }
        const root = document.documentElement;
        root.style.setProperty('--ui-scale', '${uiScale.toFixed(3)}');
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
    [calendarLayoutVars, uiScale]
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
      window.__HYBRID_API_ORIGIN__ = '${hybridApiOrigin}';
      post('bridge-ready', { href: location.href });
    })(); true;`,
    [hybridApiOrigin]
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

    const hydrateNativeTodoSession = async () => {
      const stored = await readNativeTodoSession();
      if (cancelled || !stored) {
        return;
      }

      nativeTodoSessionRef.current = stored;
      if (stored.backgroundEnteredAtMs === null) {
        return;
      }

      // 앱 재실행(콜드 스타트) 복구 경로:
      // 이전 실행에서 backgroundEnteredAtMs가 남아 있으면 비정상 종료/중단으로 보고 이탈시간 복구 payload 생성
      const resumedAtMs = Date.now();
      pendingTodoSessionRecoveryRef.current = {
        dateKey: stored.dateKey,
        todoId: stored.todoId,
        startedAt: stored.startedAt,
        sessionId: stored.sessionId,
        backgroundEnteredAtMs: stored.backgroundEnteredAtMs,
        resumedAtMs,
        elapsedSeconds: Math.max(Math.floor((resumedAtMs - stored.backgroundEnteredAtMs) / 1000), 0),
      };
      await dispatchPendingTodoSessionRecovery();
    };

    void hydrateNativeTodoSession();

    return () => {
      cancelled = true;
    };
  }, [dispatchPendingTodoSessionRecovery]);

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
        const fallbackCurrentVersion =
          Constants.expoConfig?.version?.trim() ||
          Constants.manifest2?.extra?.expoClient?.version ||
          "1.0.0";
        const prepared = await prepareWebUiBundleVersion({
          embeddedFiles: embeddedWebUiFiles,
          releaseChannel: webUiReleaseChannel,
          manifestUrl: webUiManifestUrl,
          fallbackCurrentVersion,
          onProgress: setLaunchStatusMessage,
        });

        console.log("Prepared local web-ui file:", prepared.localIndexUri);
        setLocalFileUri(prepared.localIndexUri);
        setWebUiEntryUri(prepared.entryUri);
        setWebViewUri(prepared.entryUri);
      } catch (error) {
        console.log("Failed to prepare local web-ui file:", error);
        Alert.alert("WebView Error", "Failed to prepare local web-ui file.");
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

      const currentSession = nativeTodoSessionRef.current;
      if (!currentSession) {
        return;
      }

      if (nextState === "inactive" || nextState === "background") {
        if (isDeviceLockedRef.current) {
          console.log("[DeviceLock] RN skip background timestamp because locked");
          void persistNativeTodoSession({
            ...currentSession,
            backgroundEnteredAtMs: null,
          });
          return;
        }
        if (currentSession.backgroundEnteredAtMs !== null) {
          return;
        }
        // 실행 중 세션에서 앱이 백그라운드로 내려가면 진입 시각 저장
        // 이후 복귀(active) 또는 재실행 시 elapsedSeconds 계산 기준으로 사용
        void persistNativeTodoSession({
          ...currentSession,
          backgroundEnteredAtMs: Date.now(),
        });
        return;
      }

      if (nextState !== "active" || currentSession.backgroundEnteredAtMs === null) {
        return;
      }

      if (skipNextForegroundDeviationRef.current) {
        console.log("[DeviceLock] RN skip foreground deviation recovery because locked");
        skipNextForegroundDeviationRef.current = false;
        void persistNativeTodoSession({
          ...currentSession,
          backgroundEnteredAtMs: null,
        });
        return;
      }

      // 정상 복귀(active) 경로:
      // backgroundEnteredAtMs 기준으로 경과시간을 계산해 WebView에 복구 이벤트 전달
      const resumedAtMs = Date.now();
      pendingTodoSessionRecoveryRef.current = {
        dateKey: currentSession.dateKey,
        todoId: currentSession.todoId,
        startedAt: currentSession.startedAt,
        sessionId: currentSession.sessionId,
        backgroundEnteredAtMs: currentSession.backgroundEnteredAtMs,
        resumedAtMs,
        elapsedSeconds: Math.max(Math.floor((resumedAtMs - currentSession.backgroundEnteredAtMs) / 1000), 0),
      };
      void dispatchPendingTodoSessionRecovery();
    });

    return () => {
      subscription.remove();
    };
  }, [dispatchNativeBridgeEvent, dispatchPendingTodoSessionRecovery, persistNativeTodoSession]);

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
  const handleTodoSessionSync = useCallback(
    async (payload: TodoSessionSyncPayload) => {
      if (!payload.active) {
        pendingTodoSessionRecoveryRef.current = null;
        await persistNativeTodoSession(null);
        return;
      }

      if (
        typeof payload.dateKey !== "string" ||
        typeof payload.todoId !== "string" ||
        typeof payload.startedAt !== "string" ||
        typeof payload.sessionId !== "string"
      ) {
        return;
      }

      const previous = nativeTodoSessionRef.current;
      const shouldKeepBackgroundEnteredAt =
        previous?.sessionId === payload.sessionId ? previous.backgroundEnteredAtMs : null;
      await persistNativeTodoSession({
        dateKey: payload.dateKey,
        todoId: payload.todoId,
        startedAt: payload.startedAt,
        sessionId: payload.sessionId,
        syncedAtMs: typeof payload.syncedAtMs === "number" ? payload.syncedAtMs : Date.now(),
        backgroundEnteredAtMs: shouldKeepBackgroundEnteredAt,
      });
    },
    [persistNativeTodoSession]
  );
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
          handleTodoSessionSync,
          applyWeatherSettingsSync,
        },
        notification: {
          sendBridgeResult,
          requestRestNotificationPermission,
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

  const showPermissionIntro = isPermissionIntroReady && isPermissionIntroVisible;
  const isLaunchDestinationReady = showPermissionIntro || hasInitialWebViewLoaded;
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
      {source && !showPermissionIntro ? (
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
              const activeEntryUri = webUiEntryUri ?? localFileUri;

              if (request.url.startsWith("mobile://")) {
                const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
                if (callbackHash && activeEntryUri) {
                  const nextUri = buildWebUiUriWithHash(activeEntryUri, callbackHash);
                  setWebViewUri(nextUri);
                }
                return false;
              }

              if (request.url.includes("#/auth/callback") && request.url.includes("token=")) {
                return true;
              }

              const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
              if (!callbackHash || !activeEntryUri) {
                return true;
              }

              const nextUri = buildWebUiUriWithHash(activeEntryUri, callbackHash);
              setWebViewUri(nextUri);
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
              void dispatchPendingTodoSessionRecovery();
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
