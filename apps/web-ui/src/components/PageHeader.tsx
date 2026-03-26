import { MAIN_ROUTE, ROUTE_LABEL } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
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
import { useWeatherStore } from "../stores";

type PageHeaderProps = {
  route: RouteKey;
  month: Date;
  onMonthChange: (nextMonth: Date) => void;
  onOpenMenu: () => void;
  onGoMain: () => void;
  onGoSettings: () => void;
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

export function PageHeader({
  route,
  month,
  onMonthChange,
  onOpenMenu,
  onGoMain,
  onGoSettings,
}: PageHeaderProps) {
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weather = useWeatherStore((state) => state.weather);

  if (route === MAIN_ROUTE) {
    return (
      <header className="relative mb-2 grid h-12 grid-cols-[44px_1fr_44px] items-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onOpenMenu}
          aria-label="메뉴 열기"
        >
          <FiMenu size={18} />
        </button>

        <div className="flex justify-center">
          <MonthDropdown month={month} onChange={onMonthChange} />
        </div>
        {weatherEnabled && weather ? (
          <div className="pointer-events-none absolute top-1/2 right-[3rem] -translate-y-1/2">
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
        <button
          type="button"
          className="btn btn-sm btn-ghost btn-circle justify-self-end"
          onClick={onGoSettings}
          aria-label="설정으로 이동"
        >
          <FiSettings size={18} />
        </button>
      </header>
    );
  }

  return (
    <header className="mb-2 grid h-12 grid-cols-[44px_1fr_44px] items-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
      <button
        type="button"
        className="btn btn-sm btn-ghost btn-circle"
        onClick={onGoMain}
        aria-label="뒤로가기"
      >
        <FiChevronLeft size={18} />
      </button>
      <h1 className="m-0 text-center text-lg font-semibold text-base-content">
        {ROUTE_LABEL[route]}
      </h1>
      <div aria-hidden="true" className="h-9 w-9" />
    </header>
  );
}
