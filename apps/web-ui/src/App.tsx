import { useEffect, useRef, useState } from "react";
import { CalendarPage } from "./pages/CalendarPage";
import { SimpleRoutePage } from "./pages/SimpleRoutePage";
import { SettingsPage } from "./pages/SettingsPage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { FooterBar } from "./components/FooterBar";
import { Toast } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { MAIN_ROUTE, ROUTE_LABEL } from "./routes/route-config";
import { toast, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import { shiftMonth } from "./utils/calendar";
import { fetchKoreanHolidays, type HolidaysByDate } from "./utils/holidays";
import {
  fetchCurrentWeather,
  SEOUL_COORDINATES,
  type Coordinates,
} from "./utils/weather";

type OverlayMotion = "enter" | "leave" | "idle";
const WEATHER_REFRESH_MS = 30 * 60 * 1000;

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
  const now = new Date();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [holidaysByDate, setHolidaysByDate] = useState<HolidaysByDate>({});
  const [overlayRoute, setOverlayRoute] = useState<RouteKey | null>(null);
  const [overlayMotion, setOverlayMotion] = useState<OverlayMotion>("idle");
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null);
  const weatherFallbackNotifiedRef = useRef(false);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);

  useEffect(() => {
    const prevMonth = shiftMonth(viewMonth, -1);
    const nextMonth = shiftMonth(viewMonth, 1);
    const targetYears = Array.from(
      new Set([viewMonth.getFullYear(), prevMonth.getFullYear(), nextMonth.getFullYear()])
    );

    let cancelled = false;

    const loadHolidays = async () => {
      try {
        const holidayMaps = await Promise.all(
          targetYears.map(async (year) => fetchKoreanHolidays(year))
        );
        if (cancelled) {
          return;
        }

        const merged = holidayMaps.reduce(
          (acc, holidayMap) => ({ ...acc, ...holidayMap }),
          {} as HolidaysByDate
        );
        setHolidaysByDate(merged);
      } catch (error) {
        toast.error("공휴일 데이터를 가져오지 못했어요.", "불러오기 실패");
        console.warn("Failed to load KR holidays", error);
      }
    };

    loadHolidays();

    return () => {
      cancelled = true;
    };
  }, [viewMonth]);

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

  const navigateTo = (nextRoute: RouteKey) => {
    if (nextRoute === MAIN_ROUTE) {
      if (overlayRoute) {
        setOverlayMotion("leave");
      }
      setIsDrawerOpen(false);
      return;
    }

    if (overlayRoute === nextRoute) {
      setIsDrawerOpen(false);
      return;
    }

    setOverlayRoute(nextRoute);
    setOverlayMotion("enter");
    setIsDrawerOpen(false);
  };

  const currentRoute = overlayRoute ?? MAIN_ROUTE;
  const goToday = () => {
    const nowDate = new Date();
    setViewMonth(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
  };

  return (
    <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
      <section className="app-shell mx-auto relative flex h-full w-full flex-col overflow-hidden border border-base-300 bg-base-100/95 shadow-xl backdrop-blur">
        <PageHeader
          route={MAIN_ROUTE}
          month={viewMonth}
          onMonthChange={setViewMonth}
          onOpenMenu={() => setIsDrawerOpen(true)}
          onGoMain={() => navigateTo(MAIN_ROUTE)}
          onGoSettings={() => navigateTo("settings")}
        />

        <CalendarPage
          month={viewMonth}
          onMonthChange={setViewMonth}
          holidaysByDate={holidaysByDate}
        />
        <FooterBar onGoToday={goToday} />

        {overlayRoute ? (
          <div
            className={[
              "absolute inset-0 z-20 flex flex-col bg-base-100/98 px-1.5 py-1.5 backdrop-blur-sm",
              overlayMotion === "enter"
                ? "overlay-enter"
                : overlayMotion === "leave"
                  ? "overlay-leave"
                  : "",
            ].join(" ")}
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
                navigateTo(MAIN_ROUTE);
              }
              overlayTouchStartRef.current = null;
            }}
            onAnimationEnd={() => {
              if (overlayMotion === "leave") {
                setOverlayRoute(null);
              }
              setOverlayMotion("idle");
            }}
          >
            <PageHeader
              route={overlayRoute}
              month={viewMonth}
              onMonthChange={setViewMonth}
              onOpenMenu={() => {}}
              onGoMain={() => navigateTo(MAIN_ROUTE)}
              onGoSettings={() => navigateTo("settings")}
            />
            {overlayRoute === "settings" ? (
              <SettingsPage />
            ) : (
              <SimpleRoutePage title={ROUTE_LABEL[overlayRoute]} />
            )}
          </div>
        ) : null}
      </section>

      <DrawerMenu
        isOpen={isDrawerOpen}
        activeRoute={currentRoute}
        onClose={() => setIsDrawerOpen(false)}
        onSelectRoute={navigateTo}
      />
      <Toast />
      <ConfirmModal />
    </main>
  );
}

export default App;
