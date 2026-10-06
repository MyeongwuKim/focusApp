import { useEffect, useMemo, useState } from "react";
import {
  CALENDAR_DATE_TASKS_PATH,
  MAIN_ROUTE,
  ROUTE_LABEL,
  ROUTINE_CREATE_PATH,
  ROUTINE_EDIT_PATH_PREFIX,
  ROUTINE_MANAGE_PATH,
} from "../routes/route-config";
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
  FiSun,
  FiHelpCircle,
} from "react-icons/fi";
import { useAppStore, useWeatherStore } from "../stores";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { Button } from "./ui/Button";
import { getPageHelpGuide } from "../config/pageHelpGuide";
import { PageHelpModal } from "./PageHelpModal";

type PageHeaderProps = {
  route: RouteKey;
  forcedPathname?: string;
  forcedSearch?: string;
  onBack?: () => void;
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
    return "오늘 할 일";
  }
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(target);
}

export function PageHeader({ route, forcedPathname, forcedSearch, onBack }: PageHeaderProps) {
  const location = useLocation();
  const { openMenu, goBack } = useAppNavigation();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const temperatureEnabled = useWeatherStore((state) => state.temperatureEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weather = useWeatherStore((state) => state.weather);
  const pathname = forcedPathname ?? location.pathname;
  const search = forcedSearch ?? location.search;
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isCalendarDateTasksPage =
    route === MAIN_ROUTE && normalizedPathname === CALENDAR_DATE_TASKS_PATH;
  const [isHelpModalOpen, setIsHelpModalOpen] = useState(false);
  const helpGuide = useMemo(
    () => getPageHelpGuide(isCalendarDateTasksPage ? "/date-tasks" : pathname),
    [isCalendarDateTasksPage, pathname]
  );
  const routeTitle = useMemo(() => {
    if (route === "dateTasks") {
      const normalizedPath = pathname.replace(/\/+$/, "") || "/";
      const dateParam = new URLSearchParams(search).get("date");
      if (normalizedPath === "/date-tasks/routines/new") {
        return "묶음 만들기";
      }
      if (normalizedPath === "/date-tasks/routines") {
        return "묶음 불러오기";
      }
      if (normalizedPath === "/date-tasks/add") {
        return "저장한 할 일";
      }
      if (normalizedPath === "/date-tasks/memo") {
        return dateParam ? `${dateParam} 메모` : "메모";
      }

      if (!dateParam) {
        return ROUTE_LABEL.dateTasks;
      }
      return getTasksTitleFromDateKey(dateParam);
    }

    if (route === "tasks") {
      const normalizedPath = pathname.replace(/\/+$/, "") || "/";
      if (normalizedPath === "/tasks/stats") {
        const taskLabel = new URLSearchParams(search).get("taskLabel")?.trim();
        if (taskLabel) {
          return `${taskLabel} 통계`;
        }
        return "할일 통계";
      }
    }

    if (route === "settings" || route === "routine") {
      const normalizedPath = pathname.replace(/\/+$/, "") || "/";
      if (normalizedPath === ROUTINE_CREATE_PATH) {
        return "묶음 만들기";
      }
      if (normalizedPath.startsWith(ROUTINE_EDIT_PATH_PREFIX)) {
        return "묶음 수정";
      }
      if (normalizedPath === ROUTINE_MANAGE_PATH) {
        return "할 일 묶음";
      }
      if (normalizedPath.startsWith(`${ROUTINE_MANAGE_PATH}/`)) {
        return "할 일 묶음";
      }
      if (route === "routine") {
        return ROUTE_LABEL.routine;
      }
      const subPath = pathname.replace(/^\/settings\/?/, "").split("/")[0];
      if (subPath === "weather") {
        return "날씨";
      }
      if (subPath === "routine") {
        return "할 일 묶음";
      }
      if (subPath === "notifications") {
        return "알림";
      }
      if (subPath === "account") {
        return "계정";
      }
    }

    return ROUTE_LABEL[route];
  }, [pathname, route, search]);

  useEffect(() => {
    setIsHelpModalOpen(false);
  }, [pathname, search]);

  if (
    route === MAIN_ROUTE &&
    (
      normalizedPathname === "/date-tasks" ||
      normalizedPathname === "/date-tasks/add" ||
      isCalendarDateTasksPage
    )
  ) {
    const isMainTasksPage = normalizedPathname === "/date-tasks";
    return (
      <>
        <header className="sketchbook-page-header sketchbook-header relative mb-2 flex h-12 shrink-0 items-center justify-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
          <Button
            variant="ghost"
            size="sm"
            circle
            className={[
              "sketchbook-header__binding-action absolute top-1/2",
              isMainTasksPage ? "sketchbook-header__menu-note" : "-translate-y-1/2",
            ].join(" ")}
            onClick={() => {
              if (!isMainTasksPage) {
                if (onBack) {
                  onBack();
                } else {
                  goBack({ animated: true });
                }
                return;
              }
              openMenu();
            }}
            aria-label={
              isMainTasksPage
                ? "메뉴 열기"
                : isCalendarDateTasksPage
                  ? "캘린더로 돌아가기"
                  : "오늘 할 일로 돌아가기"
            }
          >
            {isMainTasksPage ? (
              <span className="sketchbook-header__menu-note-label" aria-hidden="true">
                메뉴
              </span>
            ) : (
              <FiChevronLeft size={18} />
            )}
          </Button>

          <h1 className="sketchbook-page-header__title sketchbook-main-title m-0">{routeTitle}</h1>
          {temperatureEnabled && weather ? (
            <div className="pointer-events-none absolute top-1/2 right-[5.25rem] -translate-y-1/2">
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
          {helpGuide ? (
            <Button
              variant="ghost"
              size="sm"
              circle
              className="sketchbook-header__help-action absolute right-2 top-1/2"
              onClick={() => setIsHelpModalOpen(true)}
              aria-label="페이지 안내 보기"
            >
              <FiHelpCircle size={17} />
            </Button>
          ) : null}
        </header>
        <PageHelpModal
          isOpen={isHelpModalOpen}
          guide={helpGuide}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </>
    );
  }

  if (route === "calendar") {
    return (
      <>
        <header className="sketchbook-page-header sketchbook-header sketchbook-header--calendar relative mb-2 flex h-12 shrink-0 items-center justify-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
          <Button
            variant="ghost"
            size="sm"
            circle
            className="sketchbook-header__binding-action absolute top-1/2 -translate-y-1/2"
            onClick={() => (onBack ? onBack() : goBack({ animated: false }))}
            aria-label="뒤로가기"
          >
            <FiChevronLeft size={18} />
          </Button>
          <div className="flex justify-center">
            <MonthDropdown month={viewMonth} onChange={setViewMonth} />
          </div>
          {helpGuide ? (
            <Button
              variant="ghost"
              size="sm"
              circle
              className="sketchbook-header__help-action absolute right-2 top-1/2"
              onClick={() => setIsHelpModalOpen(true)}
              aria-label="페이지 안내 보기"
            >
              <FiHelpCircle size={17} />
            </Button>
          ) : null}
        </header>
        <PageHelpModal
          isOpen={isHelpModalOpen}
          guide={helpGuide}
          onClose={() => setIsHelpModalOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      <header className="sketchbook-page-header sketchbook-secondary-header relative mb-2 flex h-12 shrink-0 items-center justify-center rounded-2xl border border-base-300/80 bg-base-200/50 px-2">
        <Button
          variant="ghost"
          size="sm"
          circle
          className="absolute left-2 top-1/2 -translate-y-1/2"
          onClick={() => (onBack ? onBack() : goBack({ animated: false }))}
          aria-label="뒤로가기"
        >
          <FiChevronLeft size={18} />
        </Button>
        <h1
          className={[
            "sketchbook-page-header__title m-0 truncate px-2 text-center text-lg font-semibold text-base-content",
            helpGuide ? "max-w-[calc(100%-8rem)]" : "max-w-[calc(100%-4rem)]",
          ].join(" ")}
        >
          {routeTitle}
        </h1>
        {helpGuide ? (
          <Button
            variant="ghost"
            size="sm"
            circle
            className="sketchbook-header__help-action absolute right-2 top-1/2"
            onClick={() => setIsHelpModalOpen(true)}
            aria-label="페이지 안내 보기"
          >
            <FiHelpCircle size={17} />
          </Button>
        ) : null}
      </header>
      <PageHelpModal
        isOpen={isHelpModalOpen}
        guide={helpGuide}
        onClose={() => setIsHelpModalOpen(false)}
      />
    </>
  );
}
