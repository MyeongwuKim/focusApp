import * as FileSystem from "expo-file-system/legacy";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  AppState,
  type AppStateStatus,
  BackHandler,
  Linking,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import {
  buildAuthCallbackHash,
  createNativeAuthBridgeDeps,
  resolveAuthCallbackHashFromUrl,
  resolveProviderFromBridgeLoginResultType,
} from "../src/features/auth/nativeAuthBridge";
import { createNativeLocationBridgeDeps } from "../src/features/location/nativeLocationBridge";
import {
  callFocusLiveActivityModule,
  consumePendingFocusLiveActivityControlEvent,
  createNativeFocusLiveActivityBridgeDeps,
  getCurrentFocusLiveActivitySnapshot,
} from "../src/features/focus-live-activity/nativeFocusLiveActivityBridge";
import { useRestNotificationBridge } from "../src/features/notifications/hooks/useRestNotificationBridge";
import { PermissionIntroModal } from "../src/features/permissions/components/PermissionIntroModal";
import {
  hasSeenNativePermissionIntro,
  markNativePermissionIntroAsSeen,
} from "../src/features/permissions/nativePermissionIntroStorage";
import { NativeUpdateRequiredModal } from "../src/features/version/components/NativeUpdateRequiredModal";
import {
  checkNativeAppVersionPolicy,
  resolveNativeAppVersionPolicyUrl,
} from "../src/features/version/nativeAppVersionPolicy";
import {
  createNativeVersionBridgeDeps,
  openNativeAppMarket,
  resolveNativeAppVersion,
} from "../src/features/version/nativeAppRuntime";
import {
  applyNativeWeatherSettings,
  NativeWeatherLayer,
} from "../src/features/weather/components/NativeWeatherLayer";
import {
  fetchNativeWeatherSnapshot,
  WEATHER_REFRESH_MS,
  type NativeWeatherSnapshot,
} from "../src/features/weather/nativeWeather";
import { routeWebViewBridgeMessage } from "../src/features/bridge/routeWebViewBridgeMessage";
import type { RouteWebViewBridgeDeps } from "../src/features/bridge/routeWebViewBridgeMessage";
import type { TodoViewSyncPayload } from "../src/features/bridge/handlers/syncBridgeHandlers";
import {
  buildWebUiUriWithHash,
  convertCalendarSheetPathToDateTasksPath,
  formatLocalDateKey,
  hasNativeAppProtocol,
  isMainFrameWebViewRequest,
  openUrlOutsideWebView,
  parseTodoViewSnapshotFromWebViewUrl,
  resolveHybridApiOrigin,
  resolveNativeAppScheme,
  resolveNativePlatform,
  resolveNativeRoutePathFromUrl,
  shouldOpenUrlOutsideWebView,
  type NativeTodoViewSnapshot,
} from "../src/features/webview/nativeWebViewNavigation";
import {
  embeddedWebUiBundleHash,
  embeddedWebUiFiles,
} from "../src/features/webui/embeddedWebUiBundle";
import {
  prepareWebUiBundleVersion,
  resolveWebUiManifestUrl,
  resolveWebUiReleaseChannel,
  type WebUiVersionProgress,
} from "../src/features/webui/webUiVersionWorker";
import {
  FocusLaunchOverlay,
  resolveLaunchProgressPercent,
} from "../src/features/webui/components/FocusLaunchOverlay";
import { showWebUiStartupErrorAlert } from "../src/features/webui/nativeWebUiStartup";
import { readUnknownRecord, readUnknownString } from "../src/shared/nativeValues";

const BASE_WIDTH = 390;
const MIN_SCALE = 0.9;
const MAX_SCALE = 1.08;
const LAUNCH_OVERLAY_MIN_VISIBLE_MS = 800;
const FORCE_LAUNCH_OVERLAY_FOR_TEST = process.env.EXPO_PUBLIC_FORCE_LAUNCH_OVERLAY === "true";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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
  const [nativeUpdateStoreUrl, setNativeUpdateStoreUrl] = useState<string | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const nativeTodoViewRef = useRef<NativeTodoViewSnapshot>({
    isViewingTodayTodoSurface: false,
    source: "none",
    dateKey: null,
    routePath: null,
  });
  const pendingWeatherSnapshotRef = useRef<NativeWeatherSnapshot | null>(null);
  const pendingFocusLiveActivityControlEventRef = useRef<Record<string, unknown> | null>(null);
  const lastFocusLiveActivitySnapshotKeyRef = useRef<string | null>(null);
  const focusLiveActivitySnapshotRefreshUntilRef = useRef(0);
  const hasShownFatalStartupAlertRef = useRef(false);
  const hasPreparedEmbeddedWebUiRef = useRef(false);
  const [localFileUri, setLocalFileUri] = useState<string | null>(null);
  const [webUiEntryUri, setWebUiEntryUri] = useState<string | null>(null);
  const [webViewUri, setWebViewUri] = useState<string | null>(null);
  const nativeAppScheme = useMemo(() => resolveNativeAppScheme(), []);
  const nativePlatform = useMemo(() => resolveNativePlatform(), []);

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

  const navigateWebViewByTargetPath = useCallback((targetPath: string) => {
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
  }, [webUiEntryUri]);

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
  const dispatchPendingFocusLiveActivityControlEvent = useCallback(() => {
    const pendingEvent = pendingFocusLiveActivityControlEventRef.current;
    if (!pendingEvent) {
      return;
    }

    dispatchNativeBridgeEvent({
      type: "RN_FOCUS_LIVE_ACTIVITY_CONTROL_EVENT",
      payload: pendingEvent,
    });
  }, [dispatchNativeBridgeEvent]);

  const ackPendingFocusLiveActivityControlEvent = useCallback((payload: { eventId?: unknown }) => {
    const eventId = readUnknownString(payload.eventId);
    const pendingEventId = readUnknownString(pendingFocusLiveActivityControlEventRef.current?.id);
    if (!eventId || eventId !== pendingEventId) {
      return;
    }

    pendingFocusLiveActivityControlEventRef.current = null;
  }, []);

  const consumeAndDispatchPendingFocusLiveActivityControlEvent = useCallback(async () => {
    dispatchPendingFocusLiveActivityControlEvent();
    if (pendingFocusLiveActivityControlEventRef.current) {
      return;
    }

    try {
      const event = await consumePendingFocusLiveActivityControlEvent();
      const eventRecord = readUnknownRecord(event);
      if (!eventRecord) {
        return;
      }

      pendingFocusLiveActivityControlEventRef.current = eventRecord;
      dispatchPendingFocusLiveActivityControlEvent();
    } catch (error) {
      console.log("Failed to consume focus live activity control event:", error);
    }
  }, [dispatchPendingFocusLiveActivityControlEvent]);

  const dispatchCurrentFocusLiveActivitySnapshot = useCallback(
    async (options?: { force?: boolean }) => {
      try {
        const snapshot = readUnknownRecord(await getCurrentFocusLiveActivitySnapshot());
        if (!snapshot) {
          lastFocusLiveActivitySnapshotKeyRef.current = null;
          return;
        }

        const dateKey = readUnknownString(snapshot.dateKey);
        const todoId = readUnknownString(snapshot.todoId);
        if (!dateKey || !todoId) {
          return;
        }

        const isPaused = snapshot.isPaused === true ? "paused" : "running";
        const snapshotKey = `${dateKey}:${todoId}:${isPaused}`;
        const now = Date.now();
        const didSnapshotChange = lastFocusLiveActivitySnapshotKeyRef.current !== snapshotKey;
        if (didSnapshotChange) {
          focusLiveActivitySnapshotRefreshUntilRef.current = now + 10000;
        }

        if (
          !options?.force &&
          !didSnapshotChange &&
          now > focusLiveActivitySnapshotRefreshUntilRef.current
        ) {
          return;
        }

        const isDispatched = dispatchNativeBridgeEvent({
          type: "RN_FOCUS_LIVE_ACTIVITY_SNAPSHOT",
          payload: snapshot,
        });
        if (isDispatched) {
          lastFocusLiveActivitySnapshotKeyRef.current = snapshotKey;
        }
      } catch (error) {
        console.log("Failed to dispatch focus live activity snapshot:", error);
      }
    },
    [dispatchNativeBridgeEvent]
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
  const [isCheckingNativeVersion, setIsCheckingNativeVersion] = useState(true);
  const [isPreparingLocalFile, setIsPreparingLocalFile] = useState(false);
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
  const nativeAppVersionPolicyUrl = useMemo(
    () =>
      resolveNativeAppVersionPolicyUrl({
        explicitUrl: process.env.EXPO_PUBLIC_MINIMUM_APP_VERSION_URL,
        webUiManifestUrl,
      }),
    [webUiManifestUrl]
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
        const syncViewportHeight = () => {
          const nextHeight = Math.max(
            window.innerHeight || 0,
            document.documentElement?.clientHeight || 0
          );
          if (nextHeight > 0) {
            root.style.setProperty('--app-viewport-height', nextHeight + 'px');
          }
        };
        syncViewportHeight();
        if (!window.__focusHybridViewportHeightSyncInstalled) {
          window.__focusHybridViewportHeightSyncInstalled = true;
          window.addEventListener('resize', syncViewportHeight, { passive: true });
          window.addEventListener('orientationchange', syncViewportHeight, { passive: true });
        }
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
      window.__HYBRID_NATIVE_PLATFORM__ = ${JSON.stringify(nativePlatform)};
      post('bridge-ready', {
        href: location.href,
        appScheme: window.__HYBRID_APP_SCHEME__,
        platform: window.__HYBRID_NATIVE_PLATFORM__,
      });
    })(); true;`,
    [hybridApiOrigin, nativeAppScheme, nativePlatform]
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
        const hasSeenIntro = await hasSeenNativePermissionIntro();
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
    await markNativePermissionIntroAsSeen();
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
    let cancelled = false;

    const prepareLocalHtmlFile = async () => {
      const nativeAppVersion = resolveNativeAppVersion() ?? "1.0.0";

      setIsCheckingNativeVersion(true);
      setIsPreparingLocalFile(false);
      setIsNativeUpdateRequired(false);
      setNativeUpdateStoreUrl(null);

      try {
        const updateRequirement = await checkNativeAppVersionPolicy({
          policyUrl: nativeAppVersionPolicyUrl,
          channel: webUiReleaseChannel,
          platform: nativePlatform,
          currentVersion: nativeAppVersion,
        });
        if (cancelled) {
          return;
        }
        if (updateRequirement) {
          setNativeUpdateStoreUrl(updateRequirement.storeUrl);
          setIsNativeUpdateRequired(true);
          setIsCheckingNativeVersion(false);
          return;
        }
      } catch (error) {
        console.log("Failed to check native app version policy:", error);
      }

      if (cancelled) {
        return;
      }

      setIsCheckingNativeVersion(false);
      setIsPreparingLocalFile(true);

      try {
        setLaunchStatusMessage("초기 번들 준비중...");
        const prepared = await prepareWebUiBundleVersion({
          embeddedFiles: embeddedWebUiFiles,
          releaseChannel: webUiReleaseChannel,
          manifestUrl: webUiManifestUrl,
          fallbackCurrentVersion: nativeAppVersion,
          forceEmbeddedRefresh: __DEV__,
          onProgress: setLaunchStatusMessage,
        });

        if (cancelled) {
          return;
        }

        console.log("Prepared local web-ui file:", prepared.localIndexUri);
        const shouldReloadWebView = hasPreparedEmbeddedWebUiRef.current;
        hasPreparedEmbeddedWebUiRef.current = true;
        setLocalFileUri(prepared.localIndexUri);
        setWebUiEntryUri(prepared.entryUri);
        setWebViewUri(prepared.entryUri);
        if (shouldReloadWebView) {
          requestAnimationFrame(() => webViewRef.current?.reload());
        }
      } catch (error) {
        console.log("Failed to prepare local web-ui file:", error);
        if (!cancelled && !hasShownFatalStartupAlertRef.current) {
          hasShownFatalStartupAlertRef.current = true;
          showWebUiStartupErrorAlert(error);
        }
      } finally {
        if (!cancelled) {
          setIsPreparingLocalFile(false);
        }
      }
    };

    void prepareLocalHtmlFile();
    return () => {
      cancelled = true;
    };
  }, [
    embeddedWebUiBundleHash,
    nativeAppVersionPolicyUrl,
    nativePlatform,
    webUiManifestUrl,
    webUiReleaseChannel,
  ]);

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

      if (nextState === "active") {
        void consumeAndDispatchPendingFocusLiveActivityControlEvent();
        void dispatchCurrentFocusLiveActivitySnapshot({ force: true });
        setTimeout(() => {
          void consumeAndDispatchPendingFocusLiveActivityControlEvent();
          void dispatchCurrentFocusLiveActivitySnapshot({ force: true });
        }, 900);
        setTimeout(() => {
          void consumeAndDispatchPendingFocusLiveActivityControlEvent();
          void dispatchCurrentFocusLiveActivitySnapshot({ force: true });
        }, 2200);
      }
    });

    return () => {
      subscription.remove();
    };
  }, [
    consumeAndDispatchPendingFocusLiveActivityControlEvent,
    dispatchCurrentFocusLiveActivitySnapshot,
    dispatchNativeBridgeEvent,
  ]);

  useEffect(() => {
    void consumeAndDispatchPendingFocusLiveActivityControlEvent();
    void dispatchCurrentFocusLiveActivitySnapshot({ force: true });
  }, [consumeAndDispatchPendingFocusLiveActivityControlEvent, dispatchCurrentFocusLiveActivitySnapshot]);

  useEffect(() => {
    const intervalId = setInterval(() => {
      if (appStateRef.current !== "active" || !isWebViewReadyRef.current) {
        return;
      }

      void consumeAndDispatchPendingFocusLiveActivityControlEvent();
      void dispatchCurrentFocusLiveActivitySnapshot();
    }, 1500);

    return () => {
      clearInterval(intervalId);
    };
  }, [consumeAndDispatchPendingFocusLiveActivityControlEvent, dispatchCurrentFocusLiveActivitySnapshot]);

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
      if (callbackHash) {
        navigateWebViewToAuthCallbackHash(callbackHash);
        return;
      }

      const nativeRoutePath = resolveNativeRoutePathFromUrl(event.url, nativeAppScheme);
      if (nativeRoutePath) {
        navigateWebViewByTargetPath(nativeRoutePath);
      }
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
  }, [nativeAppScheme, navigateWebViewByTargetPath, navigateWebViewToAuthCallbackHash]);

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

  const bridgeDeps = useMemo<RouteWebViewBridgeDeps>(
    () => ({
      sync: {
        handleTodoViewSync,
        applyWeatherSettingsSync,
        refreshNativeWeatherSnapshot,
        syncFocusLiveActivityAuth: (payload) =>
          callFocusLiveActivityModule("configure", payload),
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
      location: createNativeLocationBridgeDeps(sendBridgeResult),
      version: createNativeVersionBridgeDeps({
        sendBridgeResult,
        webUiReleaseChannel,
        platform: nativePlatform,
      }),
      auth: createNativeAuthBridgeDeps({ sendBridgeResult, hybridApiOrigin }),
      focusLiveActivity: createNativeFocusLiveActivityBridgeDeps(
        ackPendingFocusLiveActivityControlEvent
      ),
    }),
    [
      ackPendingFocusLiveActivityControlEvent,
      applyWeatherSettingsSync,
      getRestExpoPushTokenSnapshot,
      getRestNotificationPermissionSnapshot,
      handleTodoViewSync,
      hybridApiOrigin,
      nativePlatform,
      refreshNativeWeatherSnapshot,
      requestRestNotificationPermission,
      sendBridgeResult,
      webUiReleaseChannel,
    ]
  );

  const handleMessage = async (event: WebViewMessageEvent) => {
    const { data } = event.nativeEvent;

    try {
      const parsedData = JSON.parse(data);
      if (parsedData?.__wvDebug) {
        console.log("[WebView debug]", parsedData.type, parsedData.payload);
        return;
      }
      const isHandledBridgeMessage = await routeWebViewBridgeMessage(parsedData, bridgeDeps);
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

  const showPermissionIntro =
    !isCheckingNativeVersion &&
    !isNativeUpdateRequired &&
    isPermissionIntroReady &&
    isPermissionIntroVisible;
  const isLaunchDestinationReady = isNativeUpdateRequired || showPermissionIntro || hasInitialWebViewLoaded;

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasLaunchOverlayMinElapsed(true);
    }, LAUNCH_OVERLAY_MIN_VISIBLE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, []);

  const launchProgressPercent = useMemo(
    () => resolveLaunchProgressPercent(launchStatusMessage),
    [launchStatusMessage]
  );
  const shouldShowLaunchOverlay =
    isCheckingNativeVersion ||
    FORCE_LAUNCH_OVERLAY_FOR_TEST ||
    isPreparingLocalFile ||
    !hasLaunchOverlayMinElapsed ||
    !isLaunchDestinationReady;

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {shouldShowLaunchOverlay ? (
        <FocusLaunchOverlay
          statusMessage={launchStatusMessage}
          progressPercent={launchProgressPercent}
          showProgress={!isCheckingNativeVersion}
        />
      ) : null}
      {source && !isCheckingNativeVersion && !showPermissionIntro && !isNativeUpdateRequired ? (
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
                  return false;
                }

                const nativeRoutePath = resolveNativeRoutePathFromUrl(request.url, nativeAppScheme);
                if (nativeRoutePath) {
                  navigateWebViewByTargetPath(nativeRoutePath);
                }
                return false;
              }

              const callbackHash = resolveAuthCallbackHashFromUrl(request.url, nativeAppScheme);
              if (callbackHash) {
                if (request.url.includes("#/auth/callback") && request.url.includes("token=")) {
                  return true;
                }

                navigateWebViewToAuthCallbackHash(callbackHash);
                return false;
              }

              if (
                isMainFrameWebViewRequest(request) &&
                shouldOpenUrlOutsideWebView(request.url, [webUiEntryUri, localFileUri])
              ) {
                void openUrlOutsideWebView(request.url);
                return false;
              }

              return true;
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
              void consumeAndDispatchPendingFocusLiveActivityControlEvent();
              void dispatchCurrentFocusLiveActivitySnapshot({ force: true });
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
            void openNativeAppMarket(nativeUpdateStoreUrl).catch((openError) => {
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
