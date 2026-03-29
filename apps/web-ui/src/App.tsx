import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarPage } from "./pages/CalendarPage";
import { SimpleRoutePage } from "./pages/SimpleRoutePage";
import { SettingsPage } from "./pages/SettingsPage";
import { TodoRoutePage } from "./pages/TodoRoutePage";
import { MemoPage } from "./pages/MemoPage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { FooterBar } from "./components/FooterBar";
import { Toast } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { ActionSheet } from "./components/ActionSheet";
import type { TaskItem } from "./features/todo/types";
import { MAIN_ROUTE, ROUTE_LABEL } from "./routes/route-config";
import { actionSheet, toast, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import { FiClock, FiTrash2 } from "react-icons/fi";
import { shiftMonth } from "./utils/calendar";
import { fetchKoreanHolidays, type HolidaysByDate } from "./utils/holidays";
import {
  fetchCurrentWeather,
  SEOUL_COORDINATES,
  type Coordinates,
} from "./utils/weather";

const WEATHER_REFRESH_MS = 30 * 60 * 1000;
type SessionMode = "focus" | "rest" | null;
type RestDurationMin = number | null;
const ROUTE_PATH: Record<RouteKey, string> = {
  calendar: "/calendar",
  tasks: "/tasks",
  memo: "/memo",
  stats: "/stats",
  settings: "/settings",
};

function getRouteFromPath(pathname: string): RouteKey {
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const entry = Object.entries(ROUTE_PATH).find(([, routePath]) => routePath === normalizedPath);
  return (entry?.[0] as RouteKey | undefined) ?? MAIN_ROUTE;
}

function buildRoutePath(route: RouteKey, search?: string): string {
  if (!search) {
    return ROUTE_PATH[route];
  }
  return `${ROUTE_PATH[route]}?${search}`;
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
  const now = new Date();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(
    new Date(now.getFullYear(), now.getMonth(), 1)
  );
  const [holidaysByDate, setHolidaysByDate] = useState<HolidaysByDate>({});
  const [previousOverlayRoute, setPreviousOverlayRoute] = useState<RouteKey | null>(null);
  const [tasksRouteTitle, setTasksRouteTitle] = useState(ROUTE_LABEL.tasks);
  const [tasksRouteDateKey, setTasksRouteDateKey] = useState<string | null>(null);
  const [tasksRouteItems, setTasksRouteItems] = useState<TaskItem[]>([]);
  const [completedTaskLabelsByDate, setCompletedTaskLabelsByDate] = useState<
    Record<string, string[]>
  >({
    "2026-03-26": [
      "알고리즘 문제풀기",
      "영어 단어 암기",
      "프로젝트 문서정리",
      "타입스크립트 복습",
      "블로그 글 작성",
    ],
  });
  const [celebratedDates, setCelebratedDates] = useState<Record<string, boolean>>({});
  const [showClearStamp, setShowClearStamp] = useState(false);
  const [restDurationDefaultMin, setRestDurationDefaultMin] = useState<RestDurationMin>(null);
  const [restDurationOnceMin, setRestDurationOnceMin] = useState<RestDurationMin | undefined>(
    undefined
  );
  const [sessionState, setSessionState] = useState<{
    focusMs: number;
    restMs: number;
    active: SessionMode;
    startedAt: number | null;
    restDurationMin: RestDurationMin;
  }>({
    focusMs: 0,
    restMs: 0,
    active: null,
    startedAt: null,
    restDurationMin: null,
  });
  const [sessionTick, setSessionTick] = useState(0);
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

  useEffect(() => {
    if (!sessionState.active || !sessionState.startedAt) {
      return;
    }
    const timer = window.setInterval(() => {
      setSessionTick(Date.now());
    }, 1000);
    return () => window.clearInterval(timer);
  }, [sessionState.active, sessionState.startedAt]);

  const nextRestDurationMin =
    restDurationOnceMin === undefined ? restDurationDefaultMin : restDurationOnceMin;

  const startSession = (nextMode: Exclude<SessionMode, null>) => {
    const selectedRestDurationMin = nextMode === "rest" ? nextRestDurationMin : null;
    setSessionState((prev) => {
      const nowMs = Date.now();
      let nextFocusMs = prev.focusMs;
      let nextRestMs = prev.restMs;
      if (prev.active && prev.startedAt) {
        const elapsed = nowMs - prev.startedAt;
        if (prev.active === "focus") {
          nextFocusMs += elapsed;
        } else {
          nextRestMs += elapsed;
        }
      }
      return {
        focusMs: nextFocusMs,
        restMs: nextRestMs,
        active: nextMode,
        startedAt: nowMs,
        restDurationMin: selectedRestDurationMin,
      };
    });
    if (nextMode === "rest" && restDurationOnceMin !== undefined) {
      setRestDurationOnceMin(undefined);
    }
  };

  const stopSession = () => {
    setSessionState((prev) => {
      if (!prev.active || !prev.startedAt) {
        return prev;
      }
      const nowMs = Date.now();
      const elapsed = nowMs - prev.startedAt;
      return {
        focusMs: prev.active === "focus" ? prev.focusMs + elapsed : prev.focusMs,
        restMs: prev.active === "rest" ? prev.restMs + elapsed : prev.restMs,
        active: null,
        startedAt: null,
        restDurationMin: null,
      };
    });
  };

  const toggleFocusSession = () => {
    if (sessionState.active === "focus") {
      stopSession();
      return;
    }
    startSession("focus");
  };

  const toggleRestSession = () => {
    if (sessionState.active === "rest") {
      stopSession();
      return;
    }
    startSession("rest");
  };

  useEffect(() => {
    if (
      sessionState.active !== "rest" ||
      !sessionState.startedAt ||
      sessionState.restDurationMin === null
    ) {
      return;
    }

    const restLimitMs = sessionState.restDurationMin * 60 * 1000;
    const elapsedMs = Date.now() - sessionState.startedAt;
    const remainingMs = restLimitMs - elapsedMs;

    if (remainingMs <= 0) {
      stopSession();
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
      return;
    }

    const timerId = window.setTimeout(() => {
      stopSession();
      toast.show({
        type: "positive",
        title: "휴식 종료",
        message: "설정한 휴식 시간이 끝났어요.",
        duration: 1800,
      });
    }, remainingMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [sessionState.active, sessionState.restDurationMin, sessionState.startedAt]);

  const getTasksTitleFromDateKey = (dateKey: string) => {
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
  };

  const openTasksForDate = (dateKey: string, tasks: string[]) => {
    setTasksRouteTitle(getTasksTitleFromDateKey(dateKey));
    setTasksRouteDateKey(dateKey);
    const completedLabels = new Set(completedTaskLabelsByDate[dateKey] ?? []);
    setTasksRouteItems(
      tasks.map((task, index) => ({
        id: `${dateKey}-${task}-${index}`,
        label: task,
        status: completedLabels.has(task) ? "done" : "todo",
        accumulatedMs: 0,
        startedAt: null,
        completedAt: completedLabels.has(task) ? Date.now() : null,
        completedDurationMs: completedLabels.has(task) ? 0 : null,
      }))
    );
    setShowClearStamp(false);
    setPreviousOverlayRoute(overlayRoute);
    navigate(buildRoutePath("tasks", `date=${encodeURIComponent(dateKey)}`));
    setIsDrawerOpen(false);
  };

  const handleTaskAction = (
    taskId: string,
    action: "start" | "pause" | "resume" | "complete"
  ) => {
    if (action === "start" || action === "resume") {
      startSession("focus");
    }
    const nowMs = Date.now();
    setTasksRouteItems((prevItems) =>
      prevItems.map((item) => {
        if (item.id !== taskId) {
          return item;
        }
        if (item.status === "done") {
          return item;
        }
        if (action === "complete") {
          const runningMs =
            item.status === "in_progress" && item.startedAt ? nowMs - item.startedAt : 0;
          const completedMs = item.accumulatedMs + runningMs;
          return {
            ...item,
            status: "done",
            startedAt: null,
            accumulatedMs: completedMs,
            completedAt: nowMs,
            completedDurationMs: completedMs,
          };
        }
        if (action === "start" || action === "resume") {
          return {
            ...item,
            status: "in_progress",
            startedAt: nowMs,
          };
        }
        if (action === "pause") {
          const runningMs =
            item.status === "in_progress" && item.startedAt ? nowMs - item.startedAt : 0;
          return {
            ...item,
            status: "paused",
            startedAt: null,
            accumulatedMs: item.accumulatedMs + runningMs,
          };
        }
        return item;
      })
    );

    if (action === "complete" && tasksRouteDateKey) {
      setCompletedTaskLabelsByDate((prev) => {
        const current = new Set(prev[tasksRouteDateKey] ?? []);
        const target = tasksRouteItems.find((item) => item.id === taskId);
        if (target) {
          current.add(target.label);
        }
        return {
          ...prev,
          [tasksRouteDateKey]: Array.from(current),
        };
      });
    }
  };

  const handleReorderTasks = (orderedIds: string[]) => {
    setTasksRouteItems((prevItems) => {
      const itemMap = new Map(prevItems.map((item) => [item.id, item]));
      const reordered = orderedIds
        .map((id) => itemMap.get(id))
        .filter((item): item is TaskItem => Boolean(item));
      const remaining = prevItems.filter((item) => !orderedIds.includes(item.id));
      return [...reordered, ...remaining];
    });
  };

  const handleAddTasks = (labels: string[]) => {
    if (labels.length === 0) {
      return;
    }

    setTasksRouteItems((prevItems) => {
      const existing = new Set(prevItems.map((item) => item.label));
      const nextItems = labels
        .filter((label) => !existing.has(label))
        .map((label, index) => ({
          id: `${tasksRouteDateKey ?? "today"}-${label}-${Date.now()}-${index}`,
          label,
          status: "todo" as const,
          accumulatedMs: 0,
          startedAt: null,
          completedAt: null,
          completedDurationMs: null,
        }));
      return [...prevItems, ...nextItems];
    });
  };

  const handleTaskMenuAction = async (taskId: string) => {
    const target = tasksRouteItems.find((item) => item.id === taskId);
    if (!target) {
      return;
    }

    const result = await actionSheet({
      title: target.label,
      message: "작업을 선택하세요",
      items: [
        {
          label: "시작시간 설정",
          value: "schedule",
          tone: "primary",
          icon: <FiClock size={14} />,
          description: "알림 예정 시간을 설정합니다.",
        },
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 할일을 목록에서 제거합니다.",
        },
      ],
    });

    if (result === "schedule") {
      toast.show({
        type: "positive",
        title: "준비 중",
        message: "시작시간 설정 기능은 다음 단계에서 연결할게요.",
        duration: 2200,
      });
      return;
    }

    if (result === "delete") {
      setTasksRouteItems((prevItems) => prevItems.filter((item) => item.id !== taskId));
      if (tasksRouteDateKey) {
        setCompletedTaskLabelsByDate((prev) => {
          const labels = prev[tasksRouteDateKey] ?? [];
          const nextLabels = labels.filter((label) => label !== target.label);
          return { ...prev, [tasksRouteDateKey]: nextLabels };
        });
      }
      toast.show({
        type: "positive",
        title: "삭제됨",
        message: "할일이 삭제되었습니다.",
        duration: 1800,
      });
    }
  };

  const tasksSummary = useMemo(() => {
    const totalCount = tasksRouteItems.length;
    const completedItems = tasksRouteItems.filter((item) => item.status === "done");
    const completedCount = completedItems.length;
    const completedMs = completedItems.reduce(
      (acc, item) => acc + (item.completedDurationMs ?? item.accumulatedMs),
      0
    );
    const totalMinutes = Math.round(completedMs / 60000);
    const progressPercent = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);

    return {
      totalCount,
      completedCount,
      totalMinutes,
      progressPercent,
    };
  }, [tasksRouteItems]);

  const sessionSummary = useMemo(() => {
    const nowMs = Date.now();
    const activeElapsed =
      sessionState.active && sessionState.startedAt ? nowMs - sessionState.startedAt : 0;
    const focusMs =
      sessionState.focusMs + (sessionState.active === "focus" ? activeElapsed : 0);
    const restMs = sessionState.restMs + (sessionState.active === "rest" ? activeElapsed : 0);
    return {
      active: sessionState.active,
      focusMinutes: Math.floor(focusMs / 60000),
      restMinutes: Math.floor(restMs / 60000),
      restDurationPreviewMin:
        sessionState.active === "rest" ? sessionState.restDurationMin : nextRestDurationMin,
      restDurationDefaultMin,
    };
  }, [nextRestDurationMin, restDurationDefaultMin, sessionState, sessionTick]);

  const handleApplyRestDurationOnce = (nextDurationMin: RestDurationMin) => {
    setRestDurationOnceMin(nextDurationMin);
  };

  const handleSaveRestDurationDefault = (nextDurationMin: RestDurationMin) => {
    setRestDurationDefaultMin(nextDurationMin);
    setRestDurationOnceMin(undefined);
  };

  useEffect(() => {
    if (overlayRoute !== "tasks") {
      return;
    }

    const dateParam = new URLSearchParams(location.search).get("date");
    if (!dateParam) {
      if (tasksRouteDateKey !== null) {
        setTasksRouteDateKey(null);
        setTasksRouteTitle(ROUTE_LABEL.tasks);
      }
      return;
    }

    if (dateParam === tasksRouteDateKey) {
      return;
    }

    setTasksRouteDateKey(dateParam);
    setTasksRouteTitle(getTasksTitleFromDateKey(dateParam));
    setTasksRouteItems([]);
    setShowClearStamp(false);
  }, [location.search, overlayRoute, tasksRouteDateKey]);

  useEffect(() => {
    if (overlayRoute !== "tasks" || !tasksRouteDateKey) {
      setShowClearStamp(false);
      return;
    }
    const isAllDone =
      tasksRouteItems.length > 0 && tasksRouteItems.every((item) => item.status === "done");
    if (!isAllDone || celebratedDates[tasksRouteDateKey]) {
      return;
    }
    setCelebratedDates((prev) => ({ ...prev, [tasksRouteDateKey]: true }));
    setShowClearStamp(true);
  }, [overlayRoute, tasksRouteDateKey, tasksRouteItems, celebratedDates]);

  const navigateTo = (nextRoute: RouteKey) => {
    if (activeRoute === nextRoute) {
      setIsDrawerOpen(false);
      return;
    }

    if (overlayRoute) {
      setPreviousOverlayRoute(overlayRoute);
    }

    if (nextRoute === "tasks") {
      setTasksRouteTitle(ROUTE_LABEL.tasks);
      setTasksRouteDateKey(null);
      setTasksRouteItems([]);
      setShowClearStamp(false);
    }

    navigate(ROUTE_PATH[nextRoute]);
    setIsDrawerOpen(false);
  };

  const handleOverlayBack = () => {
    if (overlayRoute === "memo" && previousOverlayRoute === "tasks") {
      setPreviousOverlayRoute(null);
      navigate(
        buildRoutePath(
          "tasks",
          tasksRouteDateKey ? `date=${encodeURIComponent(tasksRouteDateKey)}` : undefined
        )
      );
      return;
    }
    navigateTo(MAIN_ROUTE);
  };

  const currentRoute = activeRoute;
  const goToday = () => {
    const nowDate = new Date();
    setViewMonth(new Date(nowDate.getFullYear(), nowDate.getMonth(), 1));
  };

  const handleLogout = () => {
    setIsDrawerOpen(false);
    toast.show({
      type: "positive",
      title: "로그아웃",
      message: "로그아웃 기능은 곧 연결할게요.",
      duration: 1800,
    });
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
          isActive={!overlayRoute}
          onOpenTasksForDate={openTasksForDate}
          completedTaskLabelsByDate={completedTaskLabelsByDate}
        />
        <FooterBar onGoToday={goToday} />

        {overlayRoute ? (
          <div
            className="absolute inset-0 z-20 flex flex-col bg-base-100/98 px-1.5 py-1.5 backdrop-blur-sm"
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
          >
            <PageHeader
              route={overlayRoute}
              routeTitleOverride={overlayRoute === "tasks" ? tasksRouteTitle : undefined}
              month={viewMonth}
              onMonthChange={setViewMonth}
              onOpenMenu={() => {}}
              onGoMain={handleOverlayBack}
              onGoSettings={() => navigateTo("settings")}
            />
            {overlayRoute === "settings" ? (
              <SettingsPage />
            ) : overlayRoute === "tasks" ? (
              <TodoRoutePage
                isBlank
                items={tasksRouteItems}
                emptyMessage="이 날짜에는 할 일이 없어요."
                onTaskAction={handleTaskAction}
                onTaskMenuAction={handleTaskMenuAction}
                summary={tasksSummary}
                session={sessionSummary}
                onToggleFocus={toggleFocusSession}
                onToggleRest={toggleRestSession}
                onApplyRestDurationOnce={handleApplyRestDurationOnce}
                onSaveRestDurationDefault={handleSaveRestDurationDefault}
                memoDateKey={tasksRouteDateKey}
                onAddTasks={handleAddTasks}
                onReorderTasks={handleReorderTasks}
                showClearStamp={showClearStamp}
                onCloseClearStamp={() => setShowClearStamp(false)}
              />
            ) : overlayRoute === "memo" ? (
              <MemoPage />
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
        onLogout={handleLogout}
      />
      <Toast />
      <ConfirmModal />
      <ActionSheet />
    </main>
  );
}

export default App;
