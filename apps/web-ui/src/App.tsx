import { useEffect, useMemo, useRef, useState } from "react";
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
import { AppNavigationProvider } from "./providers/AppNavigationProvider";
import type { GoPageOptions, NavigateOptions } from "./providers/AppNavigationProvider";
import { MAIN_ROUTE } from "./routes/route-config";
import { toast, useAuthStore, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import { fetchCurrentWeather, SEOUL_COORDINATES, type Coordinates } from "./utils/weather";
import {
  getNativeExpoPushToken,
  getNativeLocationCoordinates,
  getNotificationPermissionStatus,
} from "./utils/notifications";
import { registerPushDeviceToken } from "./api/pushDeviceTokenApi";
import { updateNotificationSettings } from "./api/notificationSettingsApi";
import { addTodoDeviationToDailyLog, fetchDailyLogByDate } from "./api/dailyLogApi";
import { formatDateKey } from "./utils/holidays";
import { fetchMe } from "./api/userApi";
import { getUserFacingErrorMessage } from "./utils/errorMessage";

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const LOGIN_ROUTE_PATH = "/login";
const AUTH_CALLBACK_ROUTE_PATH = "/auth/callback";
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

type LocationResolveResult = {
  coordinates: Coordinates;
  source: "device" | "fallback";
  reason?: "unsupported" | "denied" | "timeout" | "unavailable" | "error";
};

function getCurrentCoordinates(timeoutMs = 5000): Promise<LocationResolveResult> {
  return getNativeLocationCoordinates()
    .then((snapshot) => {
      if (!snapshot) {
        return null;
      }
      if (snapshot.coordinates) {
        return {
          coordinates: snapshot.coordinates,
          source: "device" as const,
        };
      }
      return {
        coordinates: SEOUL_COORDINATES,
        source: "fallback" as const,
        reason:
          snapshot.status === "denied"
            ? ("denied" as const)
            : snapshot.status === "unsupported"
            ? ("unsupported" as const)
            : ("unavailable" as const),
      };
    })
    .then((nativeResult) => {
      if (nativeResult) {
        return nativeResult;
      }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return Promise.resolve({
      coordinates: SEOUL_COORDINATES,
      source: "fallback",
      reason: "unsupported",
    });
  }

  return new Promise((resolve) => {
    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        coordinates: SEOUL_COORDINATES,
        source: "fallback",
        reason: "timeout",
      });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        resolve({
          coordinates: {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          },
          source: "device",
        });
      },
      (error) => {
        if (settled) {
          return;
        }
        settled = true;
        window.clearTimeout(timeoutId);
        resolve({
          coordinates: SEOUL_COORDINATES,
          source: "fallback",
          reason:
            error.code === error.PERMISSION_DENIED
              ? "denied"
              : error.code === error.POSITION_UNAVAILABLE
              ? "unavailable"
              : error.code === error.TIMEOUT
              ? "timeout"
              : "error",
        });
      },
      { enableHighAccuracy: false, timeout: timeoutMs, maximumAge: 10 * 60 * 1000 }
    );
  });
    });
}

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
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const weatherFallbackNotifiedRef = useRef(false);
  const syncedNotificationAuthTokenRef = useRef<string | null>(null);
  const backgroundEnteredAtMsRef = useRef<number | null>(null);
  const backgroundSyncInFlightRef = useRef(false);
  const skipNextNativeForegroundFlushRef = useRef(false);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);

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
      } catch (error) {
        if (cancelled) {
          return;
        }
        setBackendBootState("error");
        setBackendBootError(getUserFacingErrorMessage(error, "서버 연결에 실패했어요."));
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
    if (!weatherEnabled) {
      useWeatherStore.getState().setWeather(null);
      return;
    }

    let cancelled = false;

    const loadWeather = async () => {
      try {
        const location = await getCurrentCoordinates();
        const nextWeather = await fetchCurrentWeather(location.coordinates);
        if (!cancelled) {
          useWeatherStore.getState().setWeather(nextWeather);
          if (location.source === "fallback" && !weatherFallbackNotifiedRef.current) {
            weatherFallbackNotifiedRef.current = true;
            if (location.reason === "denied") {
              toast.error("위치 권한이 없어 서울 날씨로 표시 중이에요.", "위치 권한 안내");
            } else {
              toast.error("현재 위치를 가져오지 못해 서울 날씨로 표시 중이에요.", "위치 안내");
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.warn("Failed to load weather", error);
        }
      }
    };

    loadWeather();
    const intervalId = window.setInterval(loadWeather, WEATHER_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [weatherEnabled]);

  useEffect(() => {
    const hasNativeWebViewBridge =
      typeof window !== "undefined" &&
      Boolean((window as Window & { ReactNativeWebView?: { postMessage?: (message: string) => void } })
        .ReactNativeWebView);

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

          await addTodoDeviationToDailyLog({
            dateKey: todayKey,
            todoId: inProgressTodo.id,
            seconds: elapsedSeconds,
          });
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

        await addTodoDeviationToDailyLog({
          dateKey,
          todoId,
          seconds: elapsedSeconds,
        });
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

    window.addEventListener(
      "focus-hybrid-native-bridge",
      handleNativeAppStateChanged as EventListener
    );
    window.addEventListener(
      "focus-hybrid-native-bridge",
      handleNativeTodoSessionRecovery as EventListener
    );
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener(
        "focus-hybrid-native-bridge",
        handleNativeAppStateChanged as EventListener
      );
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
    if (currentPath === nextPath) {
      setIsDrawerOpen(false);
      return;
    }

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

  const goBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      navigate(-1);
      return;
    }

    goPage(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    setIsDrawerOpen(false);
  };

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

  const renderOverlayBody = (route: RouteKey) => {
    switch (route) {
      case "settings":
        return <SettingsPage />;
      case "dateTasks":
        return <DateTodosRoutePage />;
      case "tasks":
        return <TaskManagementRoutePage />;
      case "stats":
        return <StatsRoutePage />;
      case "calendar":
        return null;
      default: {
        const _exhaustive: never = route;
        return _exhaustive;
      }
    }
  };

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
        {backendBootState === "checking" ? (
          <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-info/35 bg-base-100/95 px-3 py-2 text-sm text-base-content shadow-lg backdrop-blur">
              <span className="loading loading-spinner loading-xs text-info" />
              서버 연결 확인 중...
            </div>
          </div>
        ) : null}

        {backendBootState === "error" ? (
          <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-4">
            <div className="pointer-events-auto w-full max-w-lg rounded-2xl border border-error/45 bg-base-100/95 px-3 py-2 shadow-[0_14px_36px_rgba(2,6,23,0.28)] backdrop-blur">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="m-0 text-sm font-semibold text-error">서버 연결 안됨</p>
                  <p className="m-0 truncate text-xs text-base-content/70">
                    {backendBootError ?? "네트워크 상태를 확인해 주세요."}
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-xs btn-error rounded-lg"
                  onClick={() => setBackendBootRetryKey((prev) => prev + 1)}
                >
                  재시도
                </button>
              </div>
            </div>
          </div>
        ) : null}

        <section className="app-shell mx-auto relative flex h-full w-full flex-col overflow-hidden border border-base-300 bg-base-100/95 shadow-xl backdrop-blur">
          <CalendarRootPage isOverlayActive={Boolean(overlayRoute)} />

          {overlayRoute ? (
            <div
              key={overlayRoute}
              className="overlay-enter absolute inset-0 z-20 flex flex-col bg-base-100/98 px-1.5 py-1.5 backdrop-blur-sm"
              onTouchStart={(event) => {
                const touch = event.touches[0];
                overlayTouchStartRef.current = { x: touch.clientX, y: touch.clientY };
              }}
              onTouchEnd={(event) => {
                const start = overlayTouchStartRef.current;
                if (!start) {
                  return;
                }
                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - start.x;
                const deltaY = touch.clientY - start.y;
                if (deltaX > 72 && Math.abs(deltaX) > Math.abs(deltaY)) {
                  goBack();
                }
                overlayTouchStartRef.current = null;
              }}
            >
              <PageHeader route={overlayRoute} />
              <div className="min-h-0 flex flex-1 flex-col">
                {renderOverlayBody(overlayRoute)}
              </div>
            </div>
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
