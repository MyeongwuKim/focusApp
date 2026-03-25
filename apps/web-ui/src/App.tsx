import { useEffect, useRef, useState } from "react";
import { CalendarPage } from "./pages/CalendarPage";
import { SimpleRoutePage } from "./pages/SimpleRoutePage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { FooterBar } from "./components/FooterBar";
import { MAIN_ROUTE, ROUTE_LABEL } from "./routes/route-config";
import type { RouteKey } from "./routes/types";
import { shiftMonth } from "./utils/calendar";
import { fetchKoreanHolidays, type HolidaysByDate } from "./utils/holidays";

type OverlayMotion = "enter" | "leave" | "idle";

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
        console.warn("Failed to load KR holidays", error);
      }
    };

    loadHolidays();

    return () => {
      cancelled = true;
    };
  }, [viewMonth]);

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
            <SimpleRoutePage title={ROUTE_LABEL[overlayRoute]} />
          </div>
        ) : null}
      </section>

      <DrawerMenu
        isOpen={isDrawerOpen}
        activeRoute={currentRoute}
        onClose={() => setIsDrawerOpen(false)}
        onSelectRoute={navigateTo}
      />
    </main>
  );
}

export default App;
