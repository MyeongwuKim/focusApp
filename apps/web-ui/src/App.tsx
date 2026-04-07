import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { SimpleRoutePage } from "./pages/SimpleRoutePage";
import { SettingsPage } from "./pages/SettingsPage";
import { DateTodosRoutePage } from "./pages/DateTodosRoutePage";
import { MemoPage } from "./pages/MemoPage";
import { CalendarRootPage } from "./pages/CalendarRootPage";
import { TaskManagementRoutePage } from "./pages/TaskManagementRoutePage";
import { StatsRoutePage } from "./pages/StatsRoutePage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { Toast } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { ActionSheet } from "./components/ActionSheet";
import { AppNavigationProvider } from "./providers/AppNavigationProvider";
import type { NavigateOptions } from "./providers/AppNavigationProvider";
import { MAIN_ROUTE, ROUTE_LABEL } from "./routes/route-config";
import { toast, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import { fetchCurrentWeather, SEOUL_COORDINATES, type Coordinates } from "./utils/weather";

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
const ROUTE_PATH: Record<RouteKey, string> = {
  calendar: "/calendar",
  tasks: "/tasks",
  dateTasks: "/date-tasks",
  memo: "/memo",
  stats: "/stats",
  settings: "/settings",
};

function getRouteFromPath(pathname: string): RouteKey {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  if (normalizedPath === ROUTE_PATH.settings || normalizedPath.startsWith(`${ROUTE_PATH.settings}/`)) {
    return "settings";
  }

  const entry = Object.entries(ROUTE_PATH).find(([, routePath]) => normalizedPath === routePath);
  return (entry?.[0] as RouteKey | undefined) ?? MAIN_ROUTE;
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

type LocationResolveResult = {
  coordinates: Coordinates;
  source: "device" | "fallback";
  reason?: "unsupported" | "denied" | "timeout" | "unavailable" | "error";
};

function getCurrentCoordinates(timeoutMs = 5000): Promise<LocationResolveResult> {
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
}

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const activeRoute = getRouteFromPath(location.pathname);
  const overlayRoute = activeRoute === MAIN_ROUTE ? null : activeRoute;
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const weatherFallbackNotifiedRef = useRef(false);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);

  useEffect(() => {
    if (location.pathname === "/") {
      navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
      return;
    }

    if (activeRoute === MAIN_ROUTE && location.pathname !== ROUTE_PATH[MAIN_ROUTE]) {
      navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    }
  }, [activeRoute, location.pathname, navigate]);

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

  const navigateTo = (nextRoute: RouteKey, options?: NavigateOptions) => {
    if (activeRoute === nextRoute) {
      setIsDrawerOpen(false);
      return;
    }

    const search = buildSearchFromQuery(options?.query);
    navigate(buildRoutePath(nextRoute, search || undefined), {
      state: options?.state,
    });
    setIsDrawerOpen(false);
  };

  const goOverlayBack = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(ROUTE_PATH[MAIN_ROUTE], { replace: true });
    setIsDrawerOpen(false);
  };

  const navigationActions = useMemo(
    () => ({
      activeRoute,
      openMenu: () => setIsDrawerOpen(true),
      closeMenu: () => setIsDrawerOpen(false),
      navigateTo,
      goMain: () => navigateTo(MAIN_ROUTE),
      goSettings: () => navigateTo("settings"),
      goOverlayBack,
    }),
    [activeRoute, navigateTo, goOverlayBack]
  );

  const renderOverlayBody = (route: RouteKey) => {
    switch (route) {
      case "settings":
        return <SettingsPage />;
      case "dateTasks":
        return <DateTodosRoutePage />;
      case "tasks":
        return <TaskManagementRoutePage />;
      case "memo":
        return <MemoPage />;
      case "stats":
        return <StatsRoutePage />;
      default:
        return <SimpleRoutePage title={ROUTE_LABEL[route]} />;
    }
  };

  return (
    <AppNavigationProvider value={navigationActions}>
      <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
        <section className="app-shell mx-auto relative flex h-full w-full flex-col overflow-hidden border border-base-300 bg-base-100/95 shadow-xl backdrop-blur">
          <CalendarRootPage
            isOverlayActive={Boolean(overlayRoute)}
          />

          {overlayRoute ? (
            <div
              key={`${location.pathname}${location.search}`}
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
                  navigate(-1);
                }
                overlayTouchStartRef.current = null;
              }}
            >
              <PageHeader
                route={overlayRoute}
              />
              {renderOverlayBody(overlayRoute)}
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
