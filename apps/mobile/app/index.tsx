import Constants from "expo-constants";
import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Linking,
  NativeModules,
  PermissionsAndroid,
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { useRestNotificationBridge } from "../src/features/notifications/hooks/useRestNotificationBridge";
import {
  PermissionIntroModal,
  type PermissionIntroStep,
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
import { embeddedWebUiFiles } from "../src/features/webui/embeddedWebUiBundle";

const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;
const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const WEATHER_FALLBACK_COORDINATES: NativeCoordinates = {
  latitude: 37.5665,
  longitude: 126.978,
};
const PERMISSION_INTRO_FILE_URI = `${
  FileSystem.documentDirectory ?? FileSystem.cacheDirectory ?? ""
}native-permission-intro-v2.json`;

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

type TodoSessionSyncPayload = {
  active?: boolean;
  dateKey?: string | null;
  todoId?: string | null;
  startedAt?: string | null;
  sessionId?: string | null;
  syncedAtMs?: number;
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
  source: "device" | "fallback";
  reason?: "denied" | "unavailable";
  updatedAt: string;
};

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

async function hasSeenNativePermissionIntro() {
  try {
    const info = await FileSystem.getInfoAsync(PERMISSION_INTRO_FILE_URI);
    return info.exists;
  } catch {
    return false;
  }
}

async function markNativePermissionIntroAsSeen() {
  try {
    await FileSystem.writeAsStringAsync(
      PERMISSION_INTRO_FILE_URI,
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
      return {
        granted,
        canAskAgain: Boolean((result as { canAskAgain?: boolean }).canAskAgain),
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

async function fetchNativeWeatherSnapshot(): Promise<NativeWeatherSnapshot> {
  const locationSnapshot = await getLocationCoordinatesSnapshot();
  const coordinates = locationSnapshot.coordinates ?? WEATHER_FALLBACK_COORDINATES;
  const source: "device" | "fallback" = locationSnapshot.coordinates ? "device" : "fallback";
  const reason =
    source === "fallback"
      ? locationSnapshot.status === "denied"
        ? "denied"
        : "unavailable"
      : undefined;

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
    source,
    reason,
    updatedAt: new Date().toISOString(),
  };
}

export default function WebViewScreen() {
  const pendingNotificationPathRef = useRef<string | null>(null);
  const isWebViewReadyRef = useRef(false);
  const webViewRef = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [isPermissionIntroReady, setIsPermissionIntroReady] = useState(false);
  const [isPermissionIntroVisible, setIsPermissionIntroVisible] = useState(false);
  const [isRequestingNotificationPermission, setIsRequestingNotificationPermission] = useState(false);
  const [isRequestingLocationPermission, setIsRequestingLocationPermission] = useState(false);
  const [isNotificationGranted, setIsNotificationGranted] = useState(false);
  const [locationPermissionState, setLocationPermissionState] =
    useState<NativePermissionState>("undetermined");
  const [permissionStep, setPermissionStep] = useState<PermissionIntroStep>("notification");
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const nativeTodoSessionRef = useRef<NativeTodoSession | null>(null);
  const pendingTodoSessionRecoveryRef = useRef<TodoSessionRecoveryPayload | null>(null);
  const pendingWeatherSnapshotRef = useRef<NativeWeatherSnapshot | null>(null);

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
    getRestNotificationPermissionStatus,
    getRestNotificationPermissionSnapshot,
    getRestExpoPushTokenSnapshot,
  } = useRestNotificationBridge({
    onNavigate: navigateWebViewByTargetPath,
  });
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [webViewUri, setWebViewUri] = useState<string | null>(null);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(true);
  const { width, fontScale } = useWindowDimensions();
  const hybridApiOrigin = useMemo(() => resolveHybridApiOrigin(), []);

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
      pendingWeatherSnapshotRef.current = snapshot;
      dispatchPendingWeatherSnapshot();
    } catch (error) {
      console.log("Failed to fetch native weather snapshot:", error);
    }
  }, [dispatchPendingWeatherSnapshot]);

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
    let cancelled = false;

    const initializePermissionIntro = async () => {
      try {
        const [hasSeenIntro, notificationGranted, currentLocationPermissionState] = await Promise.all([
          hasSeenNativePermissionIntro(),
          getRestNotificationPermissionStatus(),
          getLocationPermissionState(),
        ]);
        if (cancelled) {
          return;
        }

        setIsNotificationGranted(notificationGranted);
        setLocationPermissionState(currentLocationPermissionState);

        const allGranted = notificationGranted && currentLocationPermissionState === "granted";
        if (hasSeenIntro || allGranted) {
          if (!hasSeenIntro) {
            await markNativePermissionIntroAsSeen();
          }
          if (!cancelled) {
            setIsPermissionIntroVisible(false);
          }
        } else {
          setPermissionStep(notificationGranted ? "location" : "notification");
          setIsPermissionIntroVisible(true);
        }
      } catch (error) {
        console.log("Failed to initialize native permission intro:", error);
        if (!cancelled) {
          setIsPermissionIntroVisible(true);
        }
      } finally {
        if (!cancelled) {
          setIsPermissionIntroReady(true);
        }
      }
    };

    initializePermissionIntro();

    return () => {
      cancelled = true;
    };
  }, [getRestNotificationPermissionStatus]);

  const closePermissionIntro = async () => {
    await markNativePermissionIntroAsSeen();
    setIsPermissionIntroVisible(false);
  };

  const handleRequestNotificationPermission = async () => {
    setIsRequestingNotificationPermission(true);
    try {
      const granted = await requestRestNotificationPermission();
      setIsNotificationGranted(granted);
      if (!granted) {
        await Linking.openSettings().catch((error) => {
          console.log("Failed to open settings from notification permission handler:", error);
        });
      }
      setPermissionStep("location");
    } catch (error) {
      console.log("Failed to request notification permission from intro screen:", error);
    } finally {
      setIsRequestingNotificationPermission(false);
    }
  };

  const handleRequestLocationPermission = async () => {
    setIsRequestingLocationPermission(true);
    try {
      const granted = await requestLocationPermission();
      const nextState = granted ? "granted" : await getLocationPermissionState();
      setLocationPermissionState(nextState);
      if (granted) {
        await refreshNativeWeatherSnapshot();
      }
      if (!granted) {
        await Linking.openSettings().catch((error) => {
          console.log("Failed to open settings from location permission handler:", error);
        });
      }
      await closePermissionIntro();
    } catch (error) {
      console.log("Failed to request location permission from intro screen:", error);
    } finally {
      setIsRequestingLocationPermission(false);
    }
  };

  useEffect(() => {
    const prepareLocalHtmlFile = async () => {
      try {
        const baseDir = `${FileSystem.cacheDirectory}web-ui/`;
        const fileUri = `${baseDir}index.html`;

        for (const file of embeddedWebUiFiles) {
          const targetUri = `${baseDir}${file.path}`;
          const targetDir = targetUri.slice(0, targetUri.lastIndexOf("/") + 1);

          await FileSystem.makeDirectoryAsync(targetDir, { intermediates: true });
          await FileSystem.writeAsStringAsync(targetUri, file.contentBase64, {
            encoding: FileSystem.EncodingType.Base64,
          });
        }

        let currentHtml = await FileSystem.readAsStringAsync(fileUri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        currentHtml = currentHtml.replace(/\s+crossorigin(?=[\s>])/gi, "");
        await FileSystem.writeAsStringAsync(fileUri, currentHtml, {
          encoding: FileSystem.EncodingType.UTF8,
        });

        const indexInfo = await FileSystem.getInfoAsync(fileUri);
        if (!indexInfo.exists) {
          Alert.alert("WebView Error", `index.html not found at ${fileUri}`);
          return;
        }

        console.log("Prepared local web-ui file:", fileUri);
        setLocalFileUri(fileUri);
        setWebViewUri(fileUri);
      } catch (error) {
        console.log("Failed to prepare local web-ui file:", error);
        Alert.alert("WebView Error", "Failed to prepare local web-ui file.");
      } finally {
        setIsPreparingLocalFile(false);
      }
    };

    prepareLocalHtmlFile();
  }, []);

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
    if (!localFileUri || !webViewRef.current) {
      return;
    }

    if (!webViewUri) {
      setWebViewUri(localFileUri);
    }

    webViewRef.current.injectJavaScript(applyScaleScript);
  }, [localFileUri, webViewUri, applyScaleScript]);

  const source = webViewUri ? { uri: webViewUri } : null;

  const handleMessage = async (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      if (parsedData?.__wvDebug) {
        console.log("[WebView debug]", parsedData.type, parsedData.payload);
        return;
      }
      if (parsedData?.type === "REST_TODO_SESSION_SYNC") {
        const payload = (parsedData?.payload ?? {}) as TodoSessionSyncPayload;
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
        return;
      }
      if (parsedData?.type === "REST_WEATHER_SETTINGS_SYNC") {
        const payload =
          parsedData?.payload && typeof parsedData.payload === "object"
            ? (parsedData.payload as { enabled?: unknown; mood?: unknown; particleClarity?: unknown })
            : null;
        if (!payload) {
          return;
        }

        applyNativeWeatherSettings({
          enabled: typeof payload.enabled === "boolean" ? payload.enabled : undefined,
          mood: typeof payload.mood === "string" ? payload.mood : undefined,
          particleClarity:
            typeof payload.particleClarity === "number" ? payload.particleClarity : undefined,
        });
        return;
      }
      if (parsedData?.type === "REST_NOTIFICATION_PERMISSION_STATUS_REQUEST") {
        const requestId =
          typeof parsedData?.requestId === "string" && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getRestNotificationPermissionSnapshot();
        const bridgeMessage = {
          type: "REST_NOTIFICATION_PERMISSION_STATUS_RESULT",
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      if (parsedData?.type === "REST_APP_OPEN_SETTINGS") {
        await Linking.openSettings().catch((error) => {
          console.log("Failed to open settings from web bridge:", error);
        });
        return;
      }

      if (parsedData?.type === "REST_LOCATION_PERMISSION_STATUS_REQUEST") {
        const requestId =
          typeof parsedData?.requestId === "string" && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getLocationPermissionSnapshot();
        const bridgeMessage = {
          type: "REST_LOCATION_PERMISSION_STATUS_RESULT",
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      if (parsedData?.type === "REST_LOCATION_COORDINATES_REQUEST") {
        const requestId =
          typeof parsedData?.requestId === "string" && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getLocationCoordinatesSnapshot();
        const bridgeMessage = {
          type: "REST_LOCATION_COORDINATES_RESULT",
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      if (parsedData?.type === "REST_PUSH_TOKEN_REQUEST") {
        const requestId =
          typeof parsedData?.requestId === "string" && parsedData.requestId.trim()
            ? parsedData.requestId
            : null;
        const snapshot = await getRestExpoPushTokenSnapshot();
        const bridgeMessage = {
          type: "REST_PUSH_TOKEN_RESULT",
          requestId,
          payload: snapshot,
        };
        webViewRef.current?.injectJavaScript(
          `window.dispatchEvent(new CustomEvent('focus-hybrid-native-bridge', { detail: ${JSON.stringify(
            bridgeMessage
          )} })); true;`
        );
        return;
      }

      const isHandledBridgeMessage = await handleRestNotificationBridgeMessage(parsedData);
      if (isHandledBridgeMessage) {
        return;
      }
      console.log("Message from web-ui:", parsedData);
      Alert.alert("Message from Web", JSON.stringify(parsedData));
    } catch (error) {
      console.log("Failed to parse web message:", data, error);
      console.log("[WebView raw message]", data);
    }
  };

  const showPermissionIntro = isPermissionIntroReady && isPermissionIntroVisible;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {isPreparingLocalFile ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
      ) : null}
      {!isPermissionIntroReady ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" />
        </View>
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
            allowsBackForwardNavigationGestures={false}
            bounces={false}
            overScrollMode="never"
            injectedJavaScriptBeforeContentLoaded={injectedBeforeContentLoaded}
            allowingReadAccessToURL={`${FileSystem.cacheDirectory}web-ui/`}
            allowFileAccess
            allowFileAccessFromFileURLs
            allowUniversalAccessFromFileURLs
            onShouldStartLoadWithRequest={(request) => {
              console.log("WebView should start request:", request.url);

              if (request.url.startsWith("mobile://")) {
                const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
                if (callbackHash && localFileUri) {
                  const nextLocalUri = `${localFileUri}${callbackHash}`;
                  setWebViewUri(nextLocalUri);
                }
                return false;
              }

              if (
                request.url.startsWith("file://") &&
                request.url.includes("#/auth/callback") &&
                request.url.includes("token=")
              ) {
                return true;
              }

              const callbackHash = resolveAuthCallbackHashFromUrl(request.url);
              if (!callbackHash || !localFileUri) {
                return true;
              }

              const nextLocalUri = `${localFileUri}${callbackHash}`;
              setWebViewUri(nextLocalUri);
              return false;
            }}
            onLoadStart={() => {
              console.log("WebView load start:", source?.uri);
              isWebViewReadyRef.current = false;
            }}
            onLoadEnd={() => {
              console.log("WebView load end:", source?.uri);
              isWebViewReadyRef.current = true;
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
            }}
            onMessage={handleMessage}
            onHttpError={(event) => {
              console.log("WebView HTTP error:", event.nativeEvent.statusCode, event.nativeEvent.description);
            }}
            onContentProcessDidTerminate={() => {
              console.log("WebView content process terminated");
            }}
            onError={(event) => {
              const msg = event.nativeEvent.description || "Unknown WebView error";
              console.log("WebView error:", msg);
              Alert.alert("WebView Error", msg);
            }}
            startInLoadingState
            renderLoading={() => (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" />
              </View>
            )}
          />
        </View>
      ) : null}
      {showPermissionIntro ? (
        <PermissionIntroModal
          step={permissionStep}
          isRequestingNotificationPermission={isRequestingNotificationPermission}
          isRequestingLocationPermission={isRequestingLocationPermission}
          onMoveToLocationStep={() => setPermissionStep("location")}
          onRequestNotificationPermission={handleRequestNotificationPermission}
          onRequestLocationPermission={handleRequestLocationPermission}
          onClose={() => {
            void closePermissionIntro();
          }}
          onOpenSettings={() => {
            Linking.openSettings().catch((error) => {
              console.log("Failed to open settings from permission intro:", error);
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
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
