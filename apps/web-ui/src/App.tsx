import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SettingsPage } from "./pages/SettingsPage";
import { DateTodosRoutePage } from "./pages/DateTodosRoutePage";
import { CalendarRootPage } from "./pages/CalendarRootPage";
import { TaskManagementRoutePage } from "./pages/TaskManagementRoutePage";
import { StatsRoutePage } from "./pages/StatsRoutePage";
import { LoginPage } from "./pages/LoginPage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { Toast } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { ActionSheet } from "./components/ActionSheet";
import { BackendConnectionBanner } from "./components/BackendConnectionBanner";
import { AppNavigationProvider } from "./providers/AppNavigationProvider";
import type { GoPageOptions, NavigateOptions } from "./providers/AppNavigationProvider";
import { MAIN_ROUTE } from "./routes/route-config";
import { useAuthStore, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import {
  getNativeExpoPushToken,
  getNotificationPermissionStatus,
  syncNativeWeatherSettings,
} from "./utils/notifications";
import { registerPushDeviceToken } from "./api/pushDeviceTokenApi";
import { updateNotificationSettings } from "./api/notificationSettingsApi";
import { addTodoDeviationToDailyLog, fetchDailyLogByDate } from "./api/dailyLogApi";
import { formatDateKey } from "./utils/holidays";
import { fetchMe } from "./api/userApi";
import { getUserFacingErrorMessage } from "./utils/errorMessage";
import { queryClient } from "./queryClient";
import { dailyLogByDateQueryKey, statsDailyDetailQueryKey } from "./queries/daily-log/queries";
import {
  getBackendConnectivityState,
  isLikelyBackendOfflineError,
  markBackendOffline,
  markBackendOnline,
  subscribeBackendConnectivity,
} from "./api/backendConnectivity";

const BACKEND_RECHECK_MS = 3000;
const LOGIN_ROUTE_PATH = "/login";
const AUTH_CALLBACK_ROUTE_PATH = "/auth/callback";
const OVERLAY_EDGE_SWIPE_START_MAX_X = 56;
const OVERLAY_EDGE_SWIPE_MIN_DISTANCE = 72;
const OVERLAY_EDGE_SWIPE_MAX_VERTICAL_DRIFT = 56;
const OVERLAY_SWIPE_AXIS_THRESHOLD = 8;
const OVERLAY_SWIPE_CLOSE_ANIMATION_MS = 320;
const OVERLAY_ENTER_ANIMATION_MS = 340;
const OVERLAY_ENTER_GUARD_MS = 720;
const OVERLAY_CAROUSEL_BACK_OFFSET_PERCENT = 16;
const OVERLAY_CAROUSEL_BACK_MIN_SCALE = 0.955;
const OVERLAY_CAROUSEL_FRONT_MIN_SCALE = 0.985;
const ROUTE_PATH: Record<RouteKey, string> = {
  calendar: "/calendar",
  tasks: "/tasks",
  dateTasks: "/date-tasks",
  stats: "/stats",
  settings: "/settings",
};

function getRouteFromPath(pathname: string): RouteKey {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const matched = (Object.entries(ROUTE_PATH) as Array<[RouteKey, string]>).find(([, routePath]) => {
    return normalizedPath === routePath || normalizedPath.startsWith(`${routePath}/`);
  });
  return matched?.[0] ?? MAIN_ROUTE;
}

function isDateTasksRoutinePath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return normalizedPath === "/date-tasks/routines" || normalizedPath === "/date-tasks/routines/new";
}

function isDateTasksMainPath(pathname: string) {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  return normalizedPath === "/date-tasks";
}

function buildRoutePath(route: RouteKey, search?: string): string {
  if (!search) {
    return ROUTE_PATH[route];
  }
  return `${ROUTE_PATH[route]}?${search}`;
}

function buildSearchFromQuery(query?: Record<string, string>) {
  if (!query) {
    return "";
  }

  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    params.set(key, value);
  });
  return params.toString();
}

function buildPagePath(path: string, query?: Record<string, string>) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const search = buildSearchFromQuery(query);
  return search ? `${normalizedPath}?${search}` : normalizedPath;
}

function getHistoryStackIndex() {
  const historyState = window.history.state as { idx?: number } | null;
  return typeof historyState?.idx === "number" ? historyState.idx : 0;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isOverlaySwipeBackBlockedTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      [
        "input",
        "textarea",
        "select",
        "button",
        "[role='button']",
        "[role='slider']",
        "[contenteditable='true']",
        "[data-disable-overlay-swipe-back='true']",
      ].join(",")
    )
  );
}

type OverlayTouchStart = {
  x: number;
  y: number;
  canSwipeBack: boolean;
  axis: "horizontal" | "vertical" | null;
};

type NativeWeatherSnapshotPayload = {
  temperature?: number;
  weatherCode?: number;
  isDay?: number;
};

type OverlayStackEntry = {
  stackIndex: number;
  route: RouteKey;
  pathname: string;
  search: string;
};

function getCallbackParam(name: string, routeSearch: string): string | null {
  const fromRouteSearch = new URLSearchParams(routeSearch).get(name);
  if (fromRouteSearch) {
    return fromRouteSearch;
  }

  const fromWindowSearch = new URLSearchParams(window.location.search).get(name);
  if (fromWindowSearch) {
    return fromWindowSearch;
  }

  const hash = window.location.hash ?? "";
  const hashQueryIndex = hash.indexOf("?");
  if (hashQueryIndex >= 0) {
    const hashQuery = hash.slice(hashQueryIndex + 1);
    return new URLSearchParams(hashQuery).get(name);
  }

  return null;
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeRoute = getRouteFromPath(location.pathname);
  const authToken = useAuthStore((state) => state.token);
  const setAuthToken = useAuthStore((state) => state.setAuthToken);
  const isLoggedIn = Boolean(authToken);
  const isLoginRoute = location.pathname === LOGIN_ROUTE_PATH;
  const isAuthCallbackRoute = location.pathname === AUTH_CALLBACK_ROUTE_PATH;
  const overlayRoute = activeRoute === MAIN_ROUTE ? null : activeRoute;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [backendBootState, setBackendBootState] = useState<"idle" | "checking" | "ready" | "error">("idle");
  const [backendBootError, setBackendBootError] = useState<string | null>(null);
  const [backendBootRetryKey, setBackendBootRetryKey] = useState(0);
  const overlayTouchStartRef = useRef<OverlayTouchStart | null>(null);
  const overlaySwipeBackTimeoutRef = useRef<number | null>(null);
  const overlayEnterAnimationTimeoutRef = useRef<number | null>(null);
  const overlayStackEntriesByIdxRef = useRef<Map<number, OverlayStackEntry>>(new Map());
  const overlayLastStackIndexRef = useRef<number | null>(null);
  const [overlayDragX, setOverlayDragX] = useState(0);
  const [overlaySwipeState, setOverlaySwipeState] = useState<"idle" | "dragging" | "settling" | "closing">(
    "idle"
  );
  const [isOverlayEntering, setIsOverlayEntering] = useState(false);
  const lastOverlayEnterRef = useRef<{ path: string; at: number } | null>(null);
  const lastOverlayNavigationRef = useRef<{ path: string; at: number } | null>(null);
  const syncedNotificationAuthTokenRef = useRef<string | null>(null);
  const backgroundEnteredAtMsRef = useRef<number | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const skipNextNativeForegroundFlushRef = useRef(false);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weatherParticleClarity = useWeatherStore((state) => state.weatherParticleClarity);

  useEffect(() => {
    if (isAuthCallbackRoute) {
      const token = getCallbackParam("token", location.search);
      if (token) {
        setAuthToken(token);
        if (window.location.protocol === "file:") {
          window.history.replaceState(null, "", "#/calendar");
        } else {
          window.history.replaceState(null, "", `${window.location.origin}/#/calendar`);
        }
        navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
        return;
      }

      navigate(LOGIN_ROUTE_PATH, { replace: true });
      return;
    }

    if (!isLoggedIn && !isLoginRoute) {
      navigate(LOGIN_ROUTE_PATH, { replace: true });
      return;
    }

    if (isLoggedIn && (location.pathname === "/" || isLoginRoute)) {
      navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
      return;
    }

    if (location.pathname === "/") {
      navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
      return;
    }

    if (
      isLoggedIn &&
      !isLoginRoute &&
      !isAuthCallbackRoute &&
      activeRoute === MAIN_ROUTE &&
      location.pathname !== ROUTE_PATH[MAIN_ROUTE]
    ) {
      navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    }
  }, [activeRoute, isAuthCallbackRoute, isLoggedIn, isLoginRoute, location.pathname, navigate]);

  useEffect(() => {
    if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
      setBackendBootState("idle");
      setBackendBootError(null);
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, 7000);

    setBackendBootState("checking");
    setBackendBootError(null);

    void (async () => {
      try {
        const me = await fetchMe({ signal: abortController.signal });
        if (cancelled) {
          return;
        }
        if (!me) {
          setAuthToken(null);
          return;
        }
        setBackendBootState("ready");
        setBackendBootError(null);
        markBackendOnline();
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBackendBootState("error");
        setBackendBootError(getUserFacingErrorMessage(error, "서버 연결에 실패했어요."));
        if (isLikelyBackendOfflineError(error)) {
          markBackendOffline();
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [backendBootRetryKey, isAuthCallbackRoute, isLoggedIn, isLoginRoute, setAuthToken]);

  useEffect(() => {
    if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
      return;
    }

    const unsubscribe = subscribeBackendConnectivity((next, previous) => {
      if (next === "offline") {
        setBackendBootState("error");
        setBackendBootError("서버 연결에 실패했어요.");
        return;
      }

      setBackendBootState("ready");
      setBackendBootError(null);
      if (previous === "offline") {
        void queryClient.resumePausedMutations();
        void queryClient.invalidateQueries();
        void queryClient.refetchQueries({ type: "active" });
      }
    });

    if (getBackendConnectivityState() === "offline") {
      setBackendBootState("error");
      setBackendBootError("서버 연결에 실패했어요.");
    }

    return () => {
      unsubscribe();
    };
  }, [isAuthCallbackRoute, isLoggedIn, isLoginRoute]);

  useEffect(() => {
    if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
      return;
    }
    if (getBackendConnectivityState() !== "offline") {
      return;
    }

    let cancelled = false;

    const probeBackend = async () => {
      try {
        const me = await fetchMe();
        if (cancelled) {
          return;
        }
        if (!me) {
          setAuthToken(null);
          return;
        }
        markBackendOnline();
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (!isLikelyBackendOfflineError(error)) {
          setBackendBootError(getUserFacingErrorMessage(error, "서버 연결에 실패했어요."));
        }
      }
    };

    void probeBackend();
    const intervalId = window.setInterval(() => {
      void probeBackend();
    }, BACKEND_RECHECK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [backendBootState, isAuthCallbackRoute, isLoggedIn, isLoginRoute, setAuthToken]);

  useEffect(() => {
    if (!weatherEnabled) {
      useWeatherStore.getState().setWeather(null);
    }
  }, [weatherEnabled]);

  useEffect(() => {
    syncNativeWeatherSettings({
      enabled: weatherEnabled,
      mood: weatherMood,
      particleClarity: weatherParticleClarity,
    });
  }, [weatherEnabled, weatherMood, weatherParticleClarity]);

  useEffect(() => {
    const handleNativeWeatherSnapshot = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: NativeWeatherSnapshotPayload;
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_WEATHER_SNAPSHOT") {
        return;
      }

      if (!weatherEnabled) {
        useWeatherStore.getState().setWeather(null);
        return;
      }

      const payload = detail.payload;
      if (
        !payload ||
        typeof payload.temperature !== "number" ||
        typeof payload.weatherCode !== "number" ||
        typeof payload.isDay !== "number"
      ) {
        return;
      }

      useWeatherStore.getState().setWeather({
        temperature: payload.temperature,
        weatherCode: payload.weatherCode,
        isDay: payload.isDay,
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleNativeWeatherSnapshot as EventListener);

    return () => {
      window.removeEventListener("focus-hybrid-native-bridge", handleNativeWeatherSnapshot as EventListener);
    };
  }, [weatherEnabled]);

  useEffect(() => {
    const hasNativeWebViewBridge =
      typeof window !== "undefined" &&
      Boolean(
        (window as Window & { ReactNativeWebView?: { postMessage?: (message: string) => void } })
          .ReactNativeWebView
      );

    const markBackgroundEntered = () => {
      if (backgroundEnteredAtMsRef.current === null) {
        backgroundEnteredAtMsRef.current = Date.now();
      }
    };

    const flushDeviationIfNeeded = async () => {
      const backgroundEnteredAtMs = backgroundEnteredAtMsRef.current;
      if (backgroundEnteredAtMs === null || backgroundSyncInFlightRef.current) {
        return;
      }

      backgroundSyncInFlightRef.current = true;
      try {
        const elapsedSeconds = Math.floor((Date.now() - backgroundEnteredAtMs) / 1000);
        const todayKey = formatDateKey(new Date());
        if (elapsedSeconds > 0) {
          const todayLog = await fetchDailyLogByDate(todayKey);
          const inProgressTodo = todayLog?.todos?.find(
            (todo) => !todo.done && Boolean(todo.startedAt) && !todo.pausedAt && !todo.completedAt
          );
          if (!inProgressTodo) {
            return;
          }

          const updatedLog = await addTodoDeviationToDailyLog({
            dateKey: todayKey,
            todoId: inProgressTodo.id,
            seconds: elapsedSeconds,
          });
          queryClient.setQueryData(dailyLogByDateQueryKey(todayKey), updatedLog);
          queryClient.setQueryData(statsDailyDetailQueryKey(todayKey), updatedLog);
        }
      } catch (error) {
        console.log("Failed to add deviation on app foreground:", error);
      } finally {
        backgroundEnteredAtMsRef.current = null;
        backgroundSyncInFlightRef.current = false;
      }
    };

    const handleNativeAppStateChanged = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: {
          state?: string;
        };
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_APP_STATE_CHANGED") {
        return;
      }
      if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
        return;
      }

      const nextState = detail.payload?.state;
      if (nextState === "inactive" || nextState === "background") {
        markBackgroundEntered();
        return;
      }

      if (nextState !== "active") {
        return;
      }
      if (skipNextNativeForegroundFlushRef.current) {
        skipNextNativeForegroundFlushRef.current = false;
        return;
      }
      await flushDeviationIfNeeded();
    };

    const handleNativeTodoSessionRecovery = async (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: {
          dateKey?: string;
          todoId?: string;
          elapsedSeconds?: number;
        };
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_TODO_SESSION_RECOVERY") {
        return;
      }
      if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
        return;
      }

      const dateKey = detail.payload?.dateKey;
      const todoId = detail.payload?.todoId;
      const elapsedSeconds =
        typeof detail.payload?.elapsedSeconds === "number"
          ? Math.max(Math.floor(detail.payload.elapsedSeconds), 0)
          : 0;
      if (!dateKey || !todoId || elapsedSeconds <= 0) {
        return;
      }

      skipNextNativeForegroundFlushRef.current = true;
      backgroundEnteredAtMsRef.current = null;

      try {
        const targetLog = await fetchDailyLogByDate(dateKey);
        const targetTodo = targetLog?.todos?.find((todo) => todo.id === todoId);
        if (!targetTodo || targetTodo.done || targetTodo.completedAt) {
          return;
        }

        const updatedLog = await addTodoDeviationToDailyLog({
          dateKey,
          todoId,
          seconds: elapsedSeconds,
        });
        queryClient.setQueryData(dailyLogByDateQueryKey(dateKey), updatedLog);
        queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), updatedLog);
      } catch (error) {
        console.log("Failed to restore deviation from native todo session:", error);
      }
    };

    const handleVisibilityChange = () => {
      if (hasNativeWebViewBridge) {
        return;
      }
      if (!isLoggedIn || isLoginRoute || isAuthCallbackRoute) {
        return;
      }

      if (document.visibilityState === "hidden") {
        markBackgroundEntered();
        return;
      }

      if (document.visibilityState === "visible") {
        void flushDeviationIfNeeded();
      }
    };

    window.addEventListener("focus-hybrid-native-bridge", handleNativeAppStateChanged as EventListener);
    window.addEventListener("focus-hybrid-native-bridge", handleNativeTodoSessionRecovery as EventListener);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus-hybrid-native-bridge", handleNativeAppStateChanged as EventListener);
      window.removeEventListener(
        "focus-hybrid-native-bridge",
        handleNativeTodoSessionRecovery as EventListener
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthCallbackRoute, isLoggedIn, isLoginRoute]);

  useEffect(() => {
    if (!isLoggedIn || !authToken) {
      syncedNotificationAuthTokenRef.current = null;
      return;
    }
    if (syncedNotificationAuthTokenRef.current === authToken) {
      return;
    }

    let cancelled = false;

    const syncNotificationPermissionAndToken = async () => {
      try {
        const permission = await getNotificationPermissionStatus();
        if (cancelled) {
          return;
        }

        await updateNotificationSettings({
          systemPermission: permission.status,
        });

        if (!permission.granted) {
          syncedNotificationAuthTokenRef.current = authToken;
          return;
        }

        const snapshot = await getNativeExpoPushToken();
        if (cancelled) {
          return;
        }
        if (!snapshot.pushToken) {
          syncedNotificationAuthTokenRef.current = authToken;
          return;
        }

        await registerPushDeviceToken({
          pushToken: snapshot.pushToken,
          platform: snapshot.platform,
        });
        syncedNotificationAuthTokenRef.current = authToken;
      } catch (error) {
        console.warn("Failed to sync notification permission/token after login", error);
      }
    };

    void syncNotificationPermissionAndToken();

    return () => {
      cancelled = true;
    };
  }, [authToken, isLoggedIn]);

  const goPage = (path: string, options?: GoPageOptions) => {
    const nextPath = buildPagePath(path, options?.query);
    const currentPath = `${location.pathname}${location.search}`;
    const liveCurrentPath =
      typeof window === "undefined" ? currentPath : `${window.location.pathname}${window.location.search}`;
    const now = Date.now();
    const isDuplicateRapidNavigation =
      lastOverlayNavigationRef.current?.path === nextPath &&
      now - lastOverlayNavigationRef.current.at < OVERLAY_ENTER_ANIMATION_MS;

    if (currentPath === nextPath || liveCurrentPath === nextPath || isDuplicateRapidNavigation) {
      setIsDrawerOpen(false);
      return;
    }

    lastOverlayNavigationRef.current = {
      path: nextPath,
      at: now,
    };
    navigate(nextPath, {
      state: options?.state,
      replace: options?.replace,
    });
    setIsDrawerOpen(false);
  };

  const navigateTo = (nextRoute: RouteKey, options?: NavigateOptions) => {
    if (activeRoute === nextRoute) {
      setIsDrawerOpen(false);
      return;
    }

    const replace = options?.replace ?? false;
    goPage(buildRoutePath(nextRoute), {
      ...options,
      replace,
    });
  };

  const performGoBackNavigation = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      navigate(-1);
      return;
    }

    goPage(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    setIsDrawerOpen(false);
  };

  const goBack = (options?: { animated?: boolean }) => {
    const prefersAnimatedBack = options?.animated ?? true;
    const stackIndex = getHistoryStackIndex();
    const previousEntry = stackIndex > 0 ? overlayStackEntriesByIdxRef.current.get(stackIndex - 1) ?? null : null;
    const previousRoute = previousEntry?.route ?? null;
    const isInternalBackWithinSameOverlay = previousRoute !== null && previousRoute === overlayRoute;
    const shouldAnimate = prefersAnimatedBack && overlayRoute !== null && !isInternalBackWithinSameOverlay;

    if (!shouldAnimate) {
      performGoBackNavigation();
      return;
    }

    if (overlaySwipeState === "closing") {
      return;
    }

    if (overlaySwipeBackTimeoutRef.current !== null) {
      window.clearTimeout(overlaySwipeBackTimeoutRef.current);
      overlaySwipeBackTimeoutRef.current = null;
    }

    const viewportWidth = window.innerWidth || 390;
    setIsOverlayEntering(false);
    setOverlaySwipeState("closing");
    setOverlayDragX(viewportWidth);
    overlaySwipeBackTimeoutRef.current = window.setTimeout(() => {
      overlaySwipeBackTimeoutRef.current = null;
      performGoBackNavigation();
      overlayTouchStartRef.current = null;
      setOverlaySwipeState("idle");
      setOverlayDragX(0);
    }, OVERLAY_SWIPE_CLOSE_ANIMATION_MS);
  };

  useEffect(() => {
    const stackIndex = getHistoryStackIndex();
    const nextEntry: OverlayStackEntry = {
      stackIndex,
      route: activeRoute,
      pathname: location.pathname,
      search: location.search,
    };
    overlayStackEntriesByIdxRef.current.set(stackIndex, nextEntry);
  }, [activeRoute, location.pathname, location.search]);

  useLayoutEffect(() => {
    overlayTouchStartRef.current = null;
    setOverlayDragX(0);
    setOverlaySwipeState("idle");
    const stackIndex = getHistoryStackIndex();
    const previousStackIndex = overlayLastStackIndexRef.current;
    overlayLastStackIndexRef.current = stackIndex;
    const shouldAnimateOverlayEnterCandidate =
      Boolean(overlayRoute) && (previousStackIndex === null || stackIndex > previousStackIndex);
    const nextOverlayPath = `${location.pathname}${location.search}`;
    const now = Date.now();
    const shouldSuppressDuplicateEnter =
      shouldAnimateOverlayEnterCandidate &&
      lastOverlayEnterRef.current?.path === nextOverlayPath &&
      now - lastOverlayEnterRef.current.at < OVERLAY_ENTER_GUARD_MS;
    const shouldAnimateOverlayEnter = shouldAnimateOverlayEnterCandidate && !shouldSuppressDuplicateEnter;
    if (shouldAnimateOverlayEnter) {
      lastOverlayEnterRef.current = {
        path: nextOverlayPath,
        at: now,
      };
    }
    setIsOverlayEntering(shouldAnimateOverlayEnter);

    if (overlaySwipeBackTimeoutRef.current !== null) {
      window.clearTimeout(overlaySwipeBackTimeoutRef.current);
      overlaySwipeBackTimeoutRef.current = null;
    }

    if (overlayEnterAnimationTimeoutRef.current !== null) {
      window.clearTimeout(overlayEnterAnimationTimeoutRef.current);
      overlayEnterAnimationTimeoutRef.current = null;
    }

    if (overlayRoute && shouldAnimateOverlayEnter) {
      overlayEnterAnimationTimeoutRef.current = window.setTimeout(() => {
        overlayEnterAnimationTimeoutRef.current = null;
        setIsOverlayEntering(false);
      }, OVERLAY_ENTER_ANIMATION_MS);
    }
  }, [location.pathname, location.search, overlayRoute]);

  useEffect(() => {
    return () => {
      if (overlaySwipeBackTimeoutRef.current !== null) {
        window.clearTimeout(overlaySwipeBackTimeoutRef.current);
      }
      if (overlayEnterAnimationTimeoutRef.current !== null) {
        window.clearTimeout(overlayEnterAnimationTimeoutRef.current);
      }
    };
  }, []);

  const navigationActions = useMemo(
    () => ({
      activeRoute,
      openMenu: () => setIsDrawerOpen(true),
      closeMenu: () => setIsDrawerOpen(false),
      goPage,
      goBack,
      navigateTo,
      goMain: () => navigateTo(MAIN_ROUTE),
      goSettings: () => navigateTo("settings"),
    }),
    [activeRoute, goBack, navigateTo, goPage]
  );

  const renderOverlayBody = (
    route: RouteKey,
    options?: {
      forcedPathname?: string;
      forcedSearch?: string;
      isActive?: boolean;
    }
  ) => {
    switch (route) {
      case "settings":
        return <SettingsPage forcedPathname={options?.forcedPathname} />;
      case "dateTasks":
        return (
          <DateTodosRoutePage
            forcedPathname={options?.forcedPathname}
            forcedSearch={options?.forcedSearch}
            isActive={options?.isActive ?? true}
          />
        );
      case "tasks":
        return (
          <TaskManagementRoutePage
            forcedPathname={options?.forcedPathname}
            forcedSearch={options?.forcedSearch}
            isActive={options?.isActive ?? true}
          />
        );
      case "stats":
        return <StatsRoutePage forcedSearch={options?.forcedSearch} />;
      case "calendar":
        return null;
      default: {
        const _exhaustive: never = route;
        return _exhaustive;
      }
    }
  };

  const overlayCurrentStackIndex = getHistoryStackIndex();
  const overlayCurrentEntryCandidate = overlayStackEntriesByIdxRef.current.get(overlayCurrentStackIndex) ?? null;
  const hasCurrentEntryLocationMismatch = Boolean(
    overlayCurrentEntryCandidate &&
      (overlayCurrentEntryCandidate.pathname !== location.pathname ||
        overlayCurrentEntryCandidate.search !== location.search)
  );
  const overlayCurrentEntry =
    overlayRoute === null
      ? null
      : !hasCurrentEntryLocationMismatch && overlayCurrentEntryCandidate
        ? overlayCurrentEntryCandidate
        : {
          stackIndex: overlayCurrentStackIndex,
          route: overlayRoute,
          pathname: location.pathname,
          search: location.search,
        };
  const overlayPreviousEntryCandidate =
    overlayCurrentEntry && overlayCurrentStackIndex > 0
      ? overlayStackEntriesByIdxRef.current.get(overlayCurrentStackIndex - 1) ?? null
      : null;
  const overlayPreviousEntry =
    overlayPreviousEntryCandidate && overlayPreviousEntryCandidate.route !== MAIN_ROUTE
      ? overlayPreviousEntryCandidate
      : null;
  const overlayRenderEntries = overlayCurrentEntry
    ? [overlayPreviousEntry, overlayCurrentEntry].filter(
        (entry): entry is OverlayStackEntry => entry !== null
      )
    : [];
  const previousStackEntryForBackdrop =
    overlayCurrentStackIndex > 0
      ? overlayStackEntriesByIdxRef.current.get(overlayCurrentStackIndex - 1) ?? null
      : null;
  const shouldRevealCalendarDateSheetBackdrop =
    overlayRoute === "dateTasks" &&
    isDateTasksRoutinePath(location.pathname) &&
    previousStackEntryForBackdrop?.route === MAIN_ROUTE &&
    overlayDragX > 0 &&
    (overlaySwipeState === "dragging" || overlaySwipeState === "settling" || overlaySwipeState === "closing");
  const shouldShowOverlaySwipePreview =
    overlayPreviousEntry !== null &&
    overlayDragX > 0 &&
    (overlaySwipeState === "dragging" || overlaySwipeState === "settling" || overlaySwipeState === "closing");
  const overlayViewportWidth = typeof window === "undefined" ? 390 : Math.max(window.innerWidth || 390, 1);
  const overlaySwipeProgress = clampNumber(overlayDragX / overlayViewportWidth, 0, 1);
  const overlayBackTranslatePercent = (1 - overlaySwipeProgress) * OVERLAY_CAROUSEL_BACK_OFFSET_PERCENT;
  const overlayBackScale =
    OVERLAY_CAROUSEL_BACK_MIN_SCALE + (1 - OVERLAY_CAROUSEL_BACK_MIN_SCALE) * overlaySwipeProgress;
  const overlayBackOpacity = 0.76 + overlaySwipeProgress * 0.24;
  const overlayFrontScale = 1 - (1 - OVERLAY_CAROUSEL_FRONT_MIN_SCALE) * overlaySwipeProgress;
  const overlayFrontOpacity = Math.max(1 - overlaySwipeProgress * 0.2, 0.8);

  if (!isLoggedIn && !isAuthCallbackRoute) {
    return <LoginPage />;
  }

  if (isAuthCallbackRoute) {
    return (
      <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
        <section className="app-shell mx-auto flex h-full w-full items-center justify-center border border-base-300 bg-base-100/95">
          <p className="text-sm text-base-content/70">로그인 처리 중...</p>
        </section>
      </main>
    );
  }

  return (
    <AppNavigationProvider value={navigationActions}>
      <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
        <BackendConnectionBanner
          state={backendBootState}
          errorMessage={backendBootError}
          onRetry={() => setBackendBootRetryKey((prev) => prev + 1)}
        />

        <section className="app-shell mx-auto relative flex h-full w-full flex-col overflow-hidden border border-base-300 bg-base-100/95 shadow-xl backdrop-blur">
          <CalendarRootPage
            isOverlayActive={Boolean(overlayRoute) && !shouldRevealCalendarDateSheetBackdrop}
          />

          {overlayCurrentEntry ? (
            <>
              {overlayRenderEntries.map((entry) => {
                const isActiveEntry = entry.stackIndex === overlayCurrentEntry.stackIndex;

                return (
                  <div
                    key={entry.stackIndex}
                    aria-hidden={!isActiveEntry}
                    className={[
                      "absolute inset-0 flex flex-col bg-base-100/98 px-1.5 py-1.5",
                      isActiveEntry ? "z-20 backdrop-blur-sm" : "z-10 pointer-events-none",
                      isActiveEntry && isOverlayEntering && overlaySwipeState === "idle" ? "overlay-enter" : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      isActiveEntry
                        ? overlaySwipeState === "idle"
                          ? undefined
                          : {
                              transform: `translateX(${overlayDragX}px) scale(${overlayFrontScale})`,
                              transformOrigin: "left center",
                              opacity: overlayFrontOpacity,
                              boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.12), -24px 0 42px rgba(2, 6, 23, 0.18)",
                              transition:
                                overlaySwipeState === "dragging"
                                  ? "none"
                                  : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease",
                            }
                        : {
                            transform: `translateX(-${overlayBackTranslatePercent}%) scale(${overlayBackScale})`,
                            transformOrigin: "left center",
                            opacity: shouldShowOverlaySwipePreview ? overlayBackOpacity : 0,
                            transition:
                              overlaySwipeState === "dragging"
                                ? "none"
                                : "transform 320ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease",
                          }
                    }
                    onTouchStart={
                      isActiveEntry
                        ? (event) => {
                            const touch = event.touches[0];
                            overlayTouchStartRef.current = {
                              x: touch.clientX,
                              y: touch.clientY,
                              canSwipeBack:
                                touch.clientX <= OVERLAY_EDGE_SWIPE_START_MAX_X &&
                                !isOverlaySwipeBackBlockedTarget(event.target) &&
                                !(entry.route === "dateTasks" && isDateTasksMainPath(entry.pathname)),
                              axis: null,
                            };
                            if (touch.clientX <= OVERLAY_EDGE_SWIPE_START_MAX_X) {
                              setIsOverlayEntering(false);
                            }
                          }
                        : undefined
                    }
                    onTouchMove={
                      isActiveEntry
                        ? (event) => {
                            const start = overlayTouchStartRef.current;
                            if (!start || !start.canSwipeBack || overlaySwipeState === "closing") {
                              return;
                            }

                            const touch = event.touches[0];
                            const deltaX = touch.clientX - start.x;
                            const deltaY = touch.clientY - start.y;

                            if (!start.axis) {
                              if (
                                Math.abs(deltaX) < OVERLAY_SWIPE_AXIS_THRESHOLD &&
                                Math.abs(deltaY) < OVERLAY_SWIPE_AXIS_THRESHOLD
                              ) {
                                return;
                              }
                              start.axis = Math.abs(deltaX) > Math.abs(deltaY) ? "horizontal" : "vertical";
                            }

                            if (start.axis !== "horizontal") {
                              return;
                            }

                            if (deltaX <= 0) {
                              if (overlayDragX !== 0) {
                                setOverlayDragX(0);
                              }
                              setOverlaySwipeState("dragging");
                              return;
                            }

                            event.preventDefault();
                            setOverlaySwipeState("dragging");
                            const viewportWidth = window.innerWidth || 390;
                            const limitedDeltaX = Math.min(deltaX, viewportWidth * 1.08);
                            const dragX =
                              limitedDeltaX <= viewportWidth
                                ? limitedDeltaX
                                : viewportWidth + (limitedDeltaX - viewportWidth) * 0.24;
                            setOverlayDragX(dragX);
                          }
                        : undefined
                    }
                    onTouchEnd={
                      isActiveEntry
                        ? (event) => {
                            const start = overlayTouchStartRef.current;
                            if (!start) {
                              return;
                            }

                            if (!start.canSwipeBack || start.axis !== "horizontal") {
                              overlayTouchStartRef.current = null;
                              if (overlaySwipeState === "dragging" && overlayDragX > 0) {
                                setOverlaySwipeState("settling");
                                setOverlayDragX(0);
                              } else {
                                setOverlaySwipeState("idle");
                              }
                              return;
                            }

                            const touch = event.changedTouches[0];
                            const deltaX = touch.clientX - start.x;
                            const deltaY = touch.clientY - start.y;
                            const closeThreshold = Math.max(
                              OVERLAY_EDGE_SWIPE_MIN_DISTANCE,
                              Math.min(window.innerWidth * 0.24, 112)
                            );
                            const shouldClose =
                              deltaX > closeThreshold &&
                              Math.abs(deltaY) <= OVERLAY_EDGE_SWIPE_MAX_VERTICAL_DRIFT &&
                              Math.abs(deltaX) > Math.abs(deltaY);

                            if (shouldClose) {
                              const viewportWidth = window.innerWidth || 390;
                              setOverlaySwipeState("closing");
                              setOverlayDragX(viewportWidth);
                              overlaySwipeBackTimeoutRef.current = window.setTimeout(() => {
                                overlaySwipeBackTimeoutRef.current = null;
                                performGoBackNavigation();
                                overlayTouchStartRef.current = null;
                                setOverlaySwipeState("idle");
                                setOverlayDragX(0);
                              }, OVERLAY_SWIPE_CLOSE_ANIMATION_MS);
                            } else {
                              if (overlayDragX > 0) {
                                setOverlaySwipeState("settling");
                                setOverlayDragX(0);
                              } else {
                                setOverlaySwipeState("idle");
                              }
                            }
                            overlayTouchStartRef.current = null;
                          }
                        : undefined
                    }
                    onTouchCancel={
                      isActiveEntry
                        ? () => {
                            overlayTouchStartRef.current = null;
                            setOverlaySwipeState(overlayDragX > 0 ? "settling" : "idle");
                            setOverlayDragX(0);
                          }
                        : undefined
                    }
                    onTransitionEnd={
                      isActiveEntry
                        ? (event) => {
                            if (event.currentTarget !== event.target) {
                              return;
                            }
                            if (overlaySwipeState === "settling") {
                              setOverlaySwipeState("idle");
                            }
                          }
                        : undefined
                    }
                  >
                    <PageHeader route={entry.route} forcedPathname={entry.pathname} forcedSearch={entry.search} />
                    <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
                      {renderOverlayBody(entry.route, {
                        forcedPathname: entry.pathname,
                        forcedSearch: entry.search,
                        isActive: isActiveEntry,
                      })}
                    </div>
                  </div>
                );
              })}
            </>
          ) : null}
        </section>

        <DrawerMenu isOpen={isDrawerOpen} />
        <Toast />
        <ConfirmModal />
        <ActionSheet />
      </main>
    </AppNavigationProvider>
  );
}

export default App;
