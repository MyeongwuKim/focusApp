import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./pages/SettingsPage";
import { RoutineRoutePage } from "./pages/RoutineRoutePage";
import { DateTodosRoutePage } from "./pages/DateTodosRoutePage";
import { CalendarRootPage } from "./pages/CalendarRootPage";
import { TaskManagementRoutePage } from "./pages/TaskManagementRoutePage";
import { AchievementsRoutePage } from "./pages/AchievementsRoutePage";
import { MemoArchiveRoutePage } from "./pages/MemoArchiveRoutePage";
import { StatsRoutePage } from "./pages/StatsRoutePage";
import { LoginPage } from "./pages/LoginPage";
import { DrawerMenu } from "./components/DrawerMenu";
import { PageHeader } from "./components/PageHeader";
import { Toast } from "./components/Toast";
import { ConfirmModal } from "./components/ConfirmModal";
import { ActionSheet } from "./components/ActionSheet";
import { BackendConnectionBanner } from "./components/BackendConnectionBanner";
import { AppNavigationProvider } from "./providers/AppNavigationProvider";
import { confirm, toast, useAppStore, useWeatherStore } from "./stores";
import type { RouteKey } from "./routes/types";
import {
  getNotificationPermissionStatus,
} from "./utils/notifications";
import {
  getLocationPermissionStatus,
  getNativeExpoPushToken,
  ackNativeFocusLiveActivityControlEvent,
  requestNativeWeatherSnapshot,
  syncNativeAuthState,
  syncNativeTodoView,
  syncNativeWeatherSettings,
} from "./utils/nativeBridge";
import { registerPushDeviceToken } from "./api/pushDeviceTokenApi";
import { fetchNotificationSettings, updateNotificationSettings } from "./api/notificationSettingsApi";
import { queryClient } from "./queryClient";
import {
  dailyLogByDateQueryKey,
  dailyLogsByMonthQueryKey,
  statsDailyDetailQueryKey,
  syncExternalDailyLogPayload,
  type DailyLogDetailPayload,
} from "./queries";
import { fetchMotivationMessage } from "./api/motivationMessageApi";
import { getApiOrigin } from "./api/graphqlEndpoint";
import { useOverlayRouteNavigation } from "./hooks/useOverlayRouteNavigation";
import { useAuthSessionGuard } from "./hooks/useAuthSessionGuard";
import { isNativeWebViewRuntime } from "./utils/runtimeEnvironment";
import { formatDateKey } from "./utils/holidays";

const SETTINGS_GUIDE_PROMPTED_KEY_PREFIX = "focus-settings-guide-prompted-v1";
const LOGIN_MOTIVATION_STALE_TIME_MS = 1000 * 60 * 60 * 3;
const LOGIN_MOTIVATION_QUERY_KEY = ["motivation-message"] as const;

function hasSeenSettingsGuidePrompt(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return true;
  }
  try {
    return window.localStorage.getItem(`${SETTINGS_GUIDE_PROMPTED_KEY_PREFIX}:${userId}`) === "1";
  } catch {
    return true;
  }
}

function markSettingsGuidePromptSeen(userId: string) {
  if (typeof window === "undefined" || !userId) {
    return;
  }
  try {
    window.localStorage.setItem(`${SETTINGS_GUIDE_PROMPTED_KEY_PREFIX}:${userId}`, "1");
  } catch {
    // ignore local storage failures
  }
}

function getAuthCacheKey(token: string) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash * 31 + token.charCodeAt(index)) | 0;
  }
  return `auth-${Math.abs(hash)}`;
}

type NativeWeatherSnapshotPayload = {
  temperature?: number;
  weatherCode?: number;
  isDay?: number;
};

function readUnknownRecord(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return value as Record<string, unknown>;
}

function readUnknownString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isNativeDailyLogPayload(value: unknown): value is DailyLogDetailPayload {
  const record = readUnknownRecord(value);
  return Boolean(record && readUnknownString(record.dateKey) && Array.isArray(record.todos));
}

function patchDailyLogByLiveActivitySnapshot(
  dailyLog: DailyLogDetailPayload | null | undefined,
  snapshot: { dateKey: string; todoId: string; isPaused: boolean }
) {
  if (!dailyLog || dailyLog.dateKey !== snapshot.dateKey) {
    return dailyLog;
  }

  let didChange = false;
  const nowIso = new Date().toISOString();
  const nextTodos = dailyLog.todos.map((todo) => {
    if (todo.id !== snapshot.todoId || todo.done || !todo.startedAt) {
      return todo;
    }

    if (snapshot.isPaused) {
      if (todo.pausedAt) {
        return todo;
      }
      didChange = true;
      return {
        ...todo,
        pausedAt: nowIso,
      };
    }

    if (!todo.pausedAt) {
      return todo;
    }

    const pausedAtMs = new Date(todo.pausedAt).getTime();
    const pausedSeconds = Number.isFinite(pausedAtMs)
      ? Math.max(Math.floor((Date.now() - pausedAtMs) / 1000), 0)
      : 0;
    didChange = true;
    return {
      ...todo,
      pausedAt: null,
      scheduledStartAt: null,
      deviationSeconds: Math.max(todo.deviationSeconds + pausedSeconds, 0),
      resumeCount: Math.max(todo.resumeCount ?? 0, 0) + 1,
    };
  });

  return didChange ? { ...dailyLog, todos: nextTodos } : dailyLog;
}

function resolveTodayTodoViewContext(input: {
  pathname: string;
  search: string;
  activeRoute: RouteKey;
  selectedDateKey: string | null;
}) {
  const todayKey = formatDateKey(new Date());
  const searchParams = new URLSearchParams(input.search);
  const routePath = `${input.pathname}${input.search}`;

  if (input.activeRoute === "dateTasks") {
    const dateKey = searchParams.get("date") ?? todayKey;
    return {
      isViewingTodayTodoSurface: dateKey === todayKey,
      source: "date-tasks" as const,
      dateKey,
      routePath,
    };
  }

  if (input.activeRoute === "calendar" && searchParams.get("sheet") === "1") {
    const dateKey = searchParams.get("date") ?? input.selectedDateKey ?? todayKey;
    return {
      isViewingTodayTodoSurface: dateKey === todayKey,
      source: "calendar-sheet" as const,
      dateKey,
      routePath,
    };
  }

  return {
    isViewingTodayTodoSurface: false,
    source: "none" as const,
    dateKey: null,
    routePath,
  };
}

function App() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const openMenu = useCallback(() => {
    setIsDrawerOpen(true);
  }, []);
  const closeMenu = useCallback(() => {
    setIsDrawerOpen(false);
  }, []);
  const {
    activeRoute,
    locationPathname,
    locationSearch,
    mainRoutePath,
    navigationActions,
    overlayRoute,
    overlayCurrentEntry,
    overlayRenderEntries,
    overlaySwipeState,
    isOverlayEntering,
    shouldRevealCalendarDateSheetBackdrop,
    getOverlayEntryStyle,
    getOverlayTouchHandlers,
  } = useOverlayRouteNavigation({ openMenu, closeMenu });
  const goSettings = navigationActions.goSettings;
  const {
    authToken,
    isLoggedIn,
    isAuthCallbackRoute,
    hasAuthSessionScopeMismatch,
    backendBootState,
    backendBootError,
    retryBackendBoot,
  } = useAuthSessionGuard({
    activeRoute,
    mainRoutePath,
  });
  const hasShownLoginMotivationThisLaunchRef = useRef(false);
  const syncedNotificationAuthTokenRef = useRef<string | null>(null);
  const weatherEnabled = useWeatherStore((state) => state.weatherEnabled);
  const weatherMood = useWeatherStore((state) => state.weatherMood);
  const weatherParticleClarity = useWeatherStore((state) => state.weatherParticleClarity);
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);

  useEffect(() => {
    if (!authToken) {
      hasShownLoginMotivationThisLaunchRef.current = false;
      return;
    }

    if (hasAuthSessionScopeMismatch) {
      return;
    }

    if (hasShownLoginMotivationThisLaunchRef.current) {
      return;
    }

    hasShownLoginMotivationThisLaunchRef.current = true;

    let cancelled = false;
    const todayDateKey = formatDateKey(new Date());

    void queryClient
      .fetchQuery({
        queryKey: [...LOGIN_MOTIVATION_QUERY_KEY, getAuthCacheKey(authToken), todayDateKey],
        staleTime: LOGIN_MOTIVATION_STALE_TIME_MS,
        gcTime: LOGIN_MOTIVATION_STALE_TIME_MS,
        queryFn: () => fetchMotivationMessage({ dateKey: todayDateKey }),
      })
      .then((result) => {
        if (cancelled) {
          return;
        }

        toast.show({
          type: "positive",
          title: "오늘 계획을 보고 한마디",
          message: result.message,
          duration: 4200,
        });
      })
      .catch(() => {
        // 로그인 경험을 방해하지 않도록 조용히 실패 처리
        hasShownLoginMotivationThisLaunchRef.current = false;
      });

    return () => {
      cancelled = true;
    };
  }, [authToken, hasAuthSessionScopeMismatch]);

  useEffect(() => {
    let cancelled = false;

    const syncWeatherVisibilityByLocationPermission = async () => {
      try {
        const status = await getLocationPermissionStatus();
        if (cancelled) {
          return;
        }

        if (!status.granted) {
          useWeatherStore.getState().setWeather(null);
          return;
        }

        requestNativeWeatherSnapshot();
      } catch (error) {
        console.warn("Failed to sync weather visibility with location permission:", error);
      }
    };

    void syncWeatherVisibilityByLocationPermission();
    const handleFocus = () => {
      void syncWeatherVisibilityByLocationPermission();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  useEffect(() => {
    syncNativeAuthState({
      loggedIn: isLoggedIn,
      token: authToken,
      apiOrigin: getApiOrigin(),
    });
  }, [authToken, isLoggedIn]);

  useEffect(() => {
    const context = resolveTodayTodoViewContext({
      pathname: locationPathname,
      search: locationSearch,
      activeRoute,
      selectedDateKey,
    });

    syncNativeTodoView({
      isViewingTodayTodoSurface: context.isViewingTodayTodoSurface,
      source: context.source,
      dateKey: context.dateKey,
      routePath: context.routePath,
    });
  }, [activeRoute, locationPathname, locationSearch, selectedDateKey]);

  useEffect(() => {
    const handleNativeAppStateChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: unknown;
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_APP_STATE_CHANGED") {
        return;
      }

      const payload = readUnknownRecord(detail.payload);
      if (payload?.isActive !== true) {
        return;
      }

      const context = resolveTodayTodoViewContext({
        pathname: locationPathname,
        search: locationSearch,
        activeRoute,
        selectedDateKey,
      });
      if (!context.dateKey) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: dailyLogByDateQueryKey(context.dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: statsDailyDetailQueryKey(context.dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: dailyLogsByMonthQueryKey(context.dateKey.slice(0, 7)),
        exact: false,
        refetchType: "active",
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleNativeAppStateChanged as EventListener);

    return () => {
      window.removeEventListener("focus-hybrid-native-bridge", handleNativeAppStateChanged as EventListener);
    };
  }, [activeRoute, locationPathname, locationSearch, selectedDateKey]);

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

      const payload = detail.payload;
      if (
        !payload ||
        typeof payload.temperature !== "number" ||
        typeof payload.weatherCode !== "number" ||
        typeof payload.isDay !== "number"
      ) {
        useWeatherStore.getState().setWeather(null);
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
  }, []);

  useEffect(() => {
    const handleNativeFocusLiveActivityControlEvent = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: unknown;
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_FOCUS_LIVE_ACTIVITY_CONTROL_EVENT") {
        return;
      }

      const payload = readUnknownRecord(detail.payload);
      if (!payload) {
        return;
      }

      const eventId = readUnknownString(payload.id);
      const dailyLog = payload.dailyLog;
      if (isNativeDailyLogPayload(dailyLog)) {
        syncExternalDailyLogPayload(queryClient, dailyLog, {
          syncMonthCache: true,
        });
        if (eventId) {
          ackNativeFocusLiveActivityControlEvent(eventId);
        }
        return;
      }

      const dateKey = readUnknownString(payload.dateKey);
      if (!dateKey) {
        return;
      }

      void queryClient.invalidateQueries({
        queryKey: dailyLogByDateQueryKey(dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: statsDailyDetailQueryKey(dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: dailyLogsByMonthQueryKey(dateKey.slice(0, 7)),
        exact: false,
        refetchType: "active",
      });
      if (eventId) {
        ackNativeFocusLiveActivityControlEvent(eventId);
      }
    };

    window.addEventListener(
      "focus-hybrid-native-bridge",
      handleNativeFocusLiveActivityControlEvent as EventListener
    );

    return () => {
      window.removeEventListener(
        "focus-hybrid-native-bridge",
        handleNativeFocusLiveActivityControlEvent as EventListener
      );
    };
  }, []);

  useEffect(() => {
    const handleNativeFocusLiveActivitySnapshot = (event: Event) => {
      const customEvent = event as CustomEvent<{
        type?: string;
        payload?: unknown;
      }>;
      const detail = customEvent.detail;
      if (detail?.type !== "RN_FOCUS_LIVE_ACTIVITY_SNAPSHOT") {
        return;
      }

      const payload = readUnknownRecord(detail.payload);
      const dateKey = readUnknownString(payload?.dateKey);
      const todoId = readUnknownString(payload?.todoId);
      if (!dateKey || !todoId) {
        return;
      }
      const snapshot = {
        dateKey,
        todoId,
        isPaused: payload?.isPaused === true,
      };

      queryClient.setQueryData<DailyLogDetailPayload | null | undefined>(
        dailyLogByDateQueryKey(dateKey),
        (previous) => patchDailyLogByLiveActivitySnapshot(previous, snapshot)
      );
      queryClient.setQueryData<DailyLogDetailPayload | null | undefined>(
        statsDailyDetailQueryKey(dateKey),
        (previous) => patchDailyLogByLiveActivitySnapshot(previous, snapshot)
      );

      void queryClient.invalidateQueries({
        queryKey: dailyLogByDateQueryKey(dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: statsDailyDetailQueryKey(dateKey),
        exact: true,
        refetchType: "active",
      });
      void queryClient.invalidateQueries({
        queryKey: dailyLogsByMonthQueryKey(dateKey.slice(0, 7)),
        exact: false,
        refetchType: "active",
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleNativeFocusLiveActivitySnapshot as EventListener);

    return () => {
      window.removeEventListener("focus-hybrid-native-bridge", handleNativeFocusLiveActivitySnapshot as EventListener);
    };
  }, []);

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

        try {
          const currentSettings = await fetchNotificationSettings();
          if (cancelled) {
            return;
          }

          const shouldPromptSettingsGuide =
            isNativeWebViewRuntime() && !hasSeenSettingsGuidePrompt(currentSettings.userId);
          if (shouldPromptSettingsGuide) {
            const result = await confirm({
              title: "알림/위치 설정을 확인해볼까요?",
              message:
                "리마인드 알림과 위치(날씨) 기능은 설정 페이지에서 한 번에 조정할 수 있어요. 지금 바로 이동할까요?",
              closeOnBackdrop: false,
              buttons: [
                { label: "다음에", value: "later" },
                { label: "설정으로 이동", value: "open", tone: "primary" },
              ],
            });
            if (cancelled) {
              return;
            }
            markSettingsGuidePromptSeen(currentSettings.userId);
            if (result === "open") {
              goSettings();
            }
          }
        } catch (error) {
          console.warn("Failed to fetch notification settings before settings guide prompt", error);
        }

        try {
          await updateNotificationSettings({
            systemPermission: permission.status,
          });
        } catch (error) {
          console.warn("Failed to update notification settings during permission sync", error);
        }

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
  }, [authToken, goSettings, isLoggedIn]);

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
      case "routine":
        return <RoutineRoutePage forcedPathname={options?.forcedPathname} />;
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
      case "achievements":
        return <AchievementsRoutePage forcedSearch={options?.forcedSearch} />;
      case "memo":
        return <MemoArchiveRoutePage />;
      case "calendar":
        return null;
      default: {
        const _exhaustive: never = route;
        return _exhaustive;
      }
    }
  };

  if (!isLoggedIn && !isAuthCallbackRoute) {
    return (
      <>
        <LoginPage />
        <Toast />
      </>
    );
  }

  if (isAuthCallbackRoute) {
    return (
      <>
        <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
          <section className="app-shell mx-auto flex h-full w-full items-center justify-center border border-base-300 bg-base-100/95">
            <p className="text-sm text-base-content/70">로그인 처리 중...</p>
          </section>
        </main>
        <Toast />
      </>
    );
  }

  return (
    <AppNavigationProvider value={navigationActions}>
      <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
        <BackendConnectionBanner
          state={backendBootState}
          errorMessage={backendBootError}
          onRetry={retryBackendBoot}
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
	                    style={getOverlayEntryStyle(isActiveEntry)}
	                    {...getOverlayTouchHandlers(entry, isActiveEntry)}
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
