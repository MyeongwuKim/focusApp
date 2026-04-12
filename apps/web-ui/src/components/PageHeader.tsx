import { useMemo } from "react";
import { MAIN_ROUTE, ROUTE_LABEL } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { useLocation } from "react-router-dom";
import { MonthDropdown } from "./MonthDropdown";
import {
  FiCloud,
  FiCloudDrizzle,
  FiCloudLightning,
  FiCloudRain,
  FiCloudSnow,
  FiChevronLeft,
  FiMoon,
  FiSettings,
  FiSun,
  FiMenu,
} from "react-icons/fi";
import { useAppStore, useWeatherStore } from "../stores";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { Button } from "./ui/Button";

type PageHeaderProps = {
  route: RouteKey;
};

function WeatherIcon({ code, isDay }: { code: number; isDay: number }) {
  if (code === 0) {
    return isDay ? <FiSun size={14} /> : <FiMoon size={14} />;
  }
  if ((code >= 45 && code <= 48) || code === 3) {
    return <FiCloud size={14} />;
  }
  if ((code >= 51 && code <= 57) || (code >= 61 && code <= 67) || (code >= 80 && code <= 82)) {
    return code >= 61 ? <FiCloudRain size={14} /> : <FiCloudDrizzle size={14} />;
  }
  if ((code >= 71 && code <= 77) || (code >= 85 && code <= 86)) {
    return <FiCloudSnow size={14} />;
  }
  if (code >= 95 && code <= 99) {
    return <FiCloudLightning size={14} />;
  }
  return <FiCloud size={14} />;
}

function getTasksTitleFromDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const target = new Date(year, month - 1, day);
  const today = new Date();
  const isToday =
    target.getFullYear() === today.getFullYear() &&
    target.getMonth() === today.getMonth() &&
    target.getDate() === today.getDate();

  if (isToday) {
    return "오늘 할일";
  }
  return `${month}.${day} 할일`;
}

export function PageHeader({ route }: PageHeaderProps) {
  const location = useLocation();
  const { openMenu, goBack, goPage } = useAppNavigation();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weather = useWeatherStore((state) => state.weather);
  const dateTasksRouteTitle = useMemo(() => {
    if (route !== "dateTasks") {
      return ROUTE_LABEL[route];
    }
    const dateParam = new URLSearchParams(location.search).get("date");
    if (!dateParam) {
      return ROUTE_LABEL.dateTasks;
    }
    return getTasksTitleFromDateKey(dateParam);
  }, [location.search, route]);

  if (route === MAIN_ROUTE) {
    return (
      <header className="relative mb-2 flex h-12 items-center justify-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
        <Button
          variant="ghost"
          size="sm"
          circle
          className="absolute left-2 top-1/2 -translate-y-1/2"
          onClick={openMenu}
          aria-label="메뉴 열기"
        >
          <FiMenu size={18} />
        </Button>

        <div className="flex justify-center">
          <MonthDropdown month={viewMonth} onChange={setViewMonth} />
        </div>
        {weatherEnabled && weather ? (
          <div className="pointer-events-none absolute top-1/2 right-12 -translate-y-1/2">
            <div
              className={[
                "inline-flex h-8 items-center gap-1 rounded-full px-2 text-xs font-medium",
                weatherMood === "cinematic"
                  ? "border border-sky-200/80 bg-slate-900/70 text-sky-100"
                  : "border border-base-300/80 bg-base-100/85 text-base-content/80",
              ].join(" ")}
            >
              <WeatherIcon code={weather.weatherCode} isDay={weather.isDay} />
              <span>{Math.round(weather.temperature)}°</span>
            </div>
          </div>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          circle
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={() => goPage("/settings")}
          aria-label="옵션으로 이동"
        >
          <FiSettings size={18} />
        </Button>
      </header>
    );
  }

  return (
    <header className="relative mb-2 flex h-12 items-center justify-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
      <Button
        variant="ghost"
        size="sm"
        circle
        className="absolute left-2 top-1/2 -translate-y-1/2"
        onClick={goBack}
        aria-label="뒤로가기"
      >
        <FiChevronLeft size={18} />
      </Button>
      <h1 className="m-0 text-center text-lg font-semibold text-base-content">
        {dateTasksRouteTitle}
      </h1>
      {route !== "settings" ? (
        <Button
          variant="ghost"
          size="sm"
          circle
          className="absolute right-2 top-1/2 -translate-y-1/2"
          onClick={() => goPage("/settings")}
          aria-label="옵션으로 이동"
        >
          <FiSettings size={18} />
        </Button>
      ) : null}
    </header>
  );
}
