import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

const REST_NOTIFICATION_CHANNEL_ID = "rest-reminder";
const DEFAULT_REST_NOTIFICATION_TITLE = "휴식 시간 종료";
const DEFAULT_REST_NOTIFICATION_BODY = "집중으로 돌아갈 시간입니다.";
const BRIDGE_NOTIFICATION_TYPES = {
  schedule: "REST_NOTIFICATION_SCHEDULE",
  cancel: "REST_NOTIFICATION_CANCEL",
  requestPermission: "REST_NOTIFICATION_PERMISSION_REQUEST",
  requestPushToken: "REST_PUSH_TOKEN_REQUEST",
} as const;

let notificationHandlerInitialized = false;
let shouldSuppressForegroundBanner: (notification: Notifications.Notification) => boolean = () => false;

function setShouldSuppressForegroundBanner(
  resolver: ((notification: Notifications.Notification) => boolean) | null
) {
  shouldSuppressForegroundBanner = resolver ?? (() => false);
}

function ensureNotificationHandler() {
  if (notificationHandlerInitialized) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const shouldSuppress = shouldSuppressForegroundBanner(notification);
      return {
        shouldShowAlert: !shouldSuppress,
        shouldPlaySound: !shouldSuppress,
        shouldSetBadge: false,
        shouldShowBanner: !shouldSuppress,
        shouldShowList: !shouldSuppress,
      };
    },
  });
  notificationHandlerInitialized = true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asPositiveNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function extractDateKeyFromNotificationKey(key: string | null) {
  if (!key) {
    return null;
  }
  const matched = key.match(/\b\d{4}-\d{2}-\d{2}\b/);
  return matched?.[0] ?? null;
}

function normalizeTargetPath(path: string) {
  if (!path.startsWith("/")) {
    return null;
  }

  const [pathname, rawSearch = ""] = path.split("?", 2);
  if (pathname !== "/date-tasks") {
    return path;
  }

  const params = new URLSearchParams(rawSearch);
  const next = new URLSearchParams();
  next.set("sheet", "1");
  const date = params.get("date");
  if (date) {
    next.set("date", date);
  }
  if (params.get("restFinished") === "1") {
    next.set("restFinished", "1");
  }
  if (params.get("focusTargetElapsed") === "1") {
    next.set("focusTargetElapsed", "1");
  }
  if (params.get("startTodoPrompt") === "1") {
    next.set("startTodoPrompt", "1");
  }
  const startTodoPromptSource = params.get("startTodoPromptSource");
  if (startTodoPromptSource) {
    next.set("startTodoPromptSource", startTodoPromptSource);
  }
  const todoId = params.get("todoId");
  if (todoId) {
    next.set("todoId", todoId);
  }

  return `/calendar?${next.toString()}`;
}

function getNotificationTargetPath(notification: Notifications.Notification) {
  const data = asRecord(notification.request.content.data);
  const rawTargetPath = asString(data?.targetPath);
  if (!rawTargetPath) {
    return null;
  }
  return normalizeTargetPath(rawTargetPath);
}

function withPromptNonce(targetPath: string, promptType: "start_todo" | "focus_target_elapsed") {
  if (promptType !== "start_todo") {
    return targetPath;
  }
  const [pathname, rawSearch = ""] = targetPath.split("?", 2);
  const params = new URLSearchParams(rawSearch);
  params.set("promptAt", String(Date.now()));
  return `${pathname}?${params.toString()}`;
}

async function ensureNotificationPermission() {
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.granted || permissions.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
    return true;
  }

  const requestResult = await Notifications.requestPermissionsAsync();
  return (
    requestResult.granted || requestResult.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
  );
}

async function ensureNotificationChannelIfNeeded() {
  if (Platform.OS !== "android") {
    return;
  }

  await Notifications.setNotificationChannelAsync(REST_NOTIFICATION_CHANNEL_ID, {
    name: "휴식 알림",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
    lightColor: "#4A8BFF",
    sound: "default",
    enableVibrate: true,
    lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
  });
}

type UseRestNotificationBridgeInput = {
  onNavigate: (path: string) => void;
  shouldInlineTodoPromptInForeground?: (
    targetPath: string,
    promptType: "start_todo" | "focus_target_elapsed"
  ) => boolean;
};

type RestNotificationPermissionSnapshot = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

type RestExpoPushTokenSnapshot = {
  pushToken: string | null;
  platform: "ios" | "android" | "unknown";
};

type RestNotificationSchedulePayload = {
  key?: string;
  title?: string;
  body?: string;
  targetPath?: string;
  seconds?: number;
};

function buildNotificationEventKey(notification: Notifications.Notification) {
  const identifier = notification.request.identifier;
  const rawDate = (notification as unknown as { date?: unknown }).date;
  const occurredAtMs =
    rawDate instanceof Date
      ? rawDate.getTime()
      : typeof rawDate === "number" && Number.isFinite(rawDate)
        ? rawDate
        : Date.now();
  const targetPath = getNotificationTargetPath(notification) ?? "";
  return `${identifier}:${occurredAtMs}:${targetPath}`;
}

export function useRestNotificationBridge({
  onNavigate,
  shouldInlineTodoPromptInForeground,
}: UseRestNotificationBridgeInput) {
  const notificationIdByKeyRef = useRef<Map<string, string>>(new Map());
  const handledResponseEventKeySetRef = useRef<Set<string>>(new Set());
  const handledReceivedEventKeySetRef = useRef<Set<string>>(new Set());

  const resolveForegroundTodoPromptType = useCallback((notification: Notifications.Notification) => {
    const data = asRecord(notification.request.content.data);
    const kind = asString(data?.kind);
    if (kind === "scheduled_todo_start" || kind === "incomplete_todo") {
      return "start_todo" as const;
    }

    const targetPath = getNotificationTargetPath(notification);
    if (!targetPath) {
      return null;
    }

    const [_, rawSearch = ""] = targetPath.split("?", 2);
    const params = new URLSearchParams(rawSearch);
    if (params.get("startTodoPrompt") === "1") {
      return "start_todo" as const;
    }
    if (params.get("focusTargetElapsed") === "1") {
      return "focus_target_elapsed" as const;
    }
    return null;
  }, []);

  const shouldInlineForegroundNotification = useCallback(
    (notification: Notifications.Notification) => {
      const promptType = resolveForegroundTodoPromptType(notification);
      if (!promptType) {
        return false;
      }
      const targetPath = getNotificationTargetPath(notification);
      if (!targetPath) {
        return false;
      }
      return shouldInlineTodoPromptInForeground?.(targetPath, promptType) ?? false;
    },
    [resolveForegroundTodoPromptType, shouldInlineTodoPromptInForeground]
  );

  useEffect(() => {
    setShouldSuppressForegroundBanner(shouldInlineForegroundNotification);
    ensureNotificationHandler();
    return () => {
      setShouldSuppressForegroundBanner(null);
    };
  }, [shouldInlineForegroundNotification]);

  useEffect(() => {
    const receivedSubscription = Notifications.addNotificationReceivedListener((notification) => {
      const promptType = resolveForegroundTodoPromptType(notification);
      if (!promptType || !shouldInlineForegroundNotification(notification)) {
        return;
      }

      const receivedEventKey = buildNotificationEventKey(notification);
      if (handledReceivedEventKeySetRef.current.has(receivedEventKey)) {
        return;
      }
      handledReceivedEventKeySetRef.current.add(receivedEventKey);

      // 포그라운드 인앱 분기 시 시스템 배너/리스트가 남지 않도록 즉시 정리
      const receivedId = notification.request.identifier;
      void Notifications.dismissNotificationAsync(receivedId).catch(() => null);

      const targetPath = getNotificationTargetPath(notification);
      if (targetPath && promptType === "start_todo") {
        onNavigate(withPromptNonce(targetPath, promptType));
      }
    });

    return () => {
      receivedSubscription.remove();
    };
  }, [onNavigate, resolveForegroundTodoPromptType, shouldInlineForegroundNotification]);

  const handleNotificationResponseNavigation = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const responseEventKey = buildNotificationEventKey(response.notification);
      if (handledResponseEventKeySetRef.current.has(responseEventKey)) {
        return;
      }
      handledResponseEventKeySetRef.current.add(responseEventKey);

      const targetPath = getNotificationTargetPath(response.notification);
      if (targetPath) {
        const promptType = resolveForegroundTodoPromptType(response.notification);
        onNavigate(promptType ? withPromptNonce(targetPath, promptType) : targetPath);
      }
    },
    [onNavigate, resolveForegroundTodoPromptType]
  );

  useEffect(() => {
    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationResponseNavigation(response);
    });

    return () => {
      responseSubscription.remove();
    };
  }, [handleNotificationResponseNavigation]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        handleNotificationResponseNavigation(response);
      })
      .catch((error) => {
        console.log("Failed to read last notification response:", error);
      });
  }, [handleNotificationResponseNavigation]);

  const scheduleRestNotification = useCallback(async (payload: RestNotificationSchedulePayload) => {
    const granted = await ensureNotificationPermission();
    if (!granted) {
      return null;
    }

    await ensureNotificationChannelIfNeeded();

    const seconds = asPositiveNumber(payload.seconds) ?? 1;
    const key = asString(payload.key)?.trim() || null;
    const title = asString(payload.title) ?? DEFAULT_REST_NOTIFICATION_TITLE;
    const body = asString(payload.body) ?? DEFAULT_REST_NOTIFICATION_BODY;
    const parsedDateKey = extractDateKeyFromNotificationKey(key);
    const targetPath =
      normalizeTargetPath(asString(payload.targetPath) ?? "") ??
      (parsedDateKey ? `/calendar?sheet=1&date=${parsedDateKey}&restFinished=1` : "/calendar?sheet=1");

    if (key) {
      const existingNotificationId = notificationIdByKeyRef.current.get(key);
      if (existingNotificationId) {
        await Notifications.cancelScheduledNotificationAsync(existingNotificationId).catch((error) => {
          console.log("Failed to cancel existing rest notification:", error);
        });
      }
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data: {
          targetPath,
        },
        sound: true,
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds,
      },
    });

    if (key) {
      notificationIdByKeyRef.current.set(key, notificationId);
    }

    return notificationId;
  }, []);

  const cancelRestNotification = useCallback(async (key?: string) => {
    if (!key) {
      const ids = Array.from(notificationIdByKeyRef.current.values());
      await Promise.all(
        ids.map((id) =>
          Notifications.cancelScheduledNotificationAsync(id).catch((error) => {
            console.log("Failed to cancel rest notification:", error);
          })
        )
      );
      notificationIdByKeyRef.current.clear();
      return;
    }

    const id = notificationIdByKeyRef.current.get(key);
    if (!id) {
      return;
    }

    await Notifications.cancelScheduledNotificationAsync(id).catch((error) => {
      console.log("Failed to cancel rest notification by key:", error);
    });
    notificationIdByKeyRef.current.delete(key);
  }, []);

  const handleRestNotificationBridgeMessage = useCallback(
    async (message: unknown) => {
      const record = asRecord(message);
      if (!record) {
        return false;
      }

      const type = asString(record.type);
      if (!type) {
        return false;
      }

      if (type === BRIDGE_NOTIFICATION_TYPES.requestPermission) {
        await ensureNotificationPermission();
        await ensureNotificationChannelIfNeeded();
        return true;
      }

      if (type === BRIDGE_NOTIFICATION_TYPES.requestPushToken) {
        return true;
      }

      if (type === BRIDGE_NOTIFICATION_TYPES.schedule) {
        const payload = asRecord(record.payload);
        await scheduleRestNotification({
          key: asString(payload?.key) ?? undefined,
          title: asString(payload?.title) ?? undefined,
          body: asString(payload?.body) ?? undefined,
          targetPath: asString(payload?.targetPath) ?? undefined,
          seconds: asPositiveNumber(payload?.seconds) ?? undefined,
        });
        return true;
      }

      if (type === BRIDGE_NOTIFICATION_TYPES.cancel) {
        const payload = asRecord(record.payload);
        const key = asString(payload?.key) ?? undefined;
        await cancelRestNotification(key);
        return true;
      }

      return false;
    },
    [cancelRestNotification, scheduleRestNotification]
  );

  const requestRestNotificationPermission = useCallback(async () => {
    const granted = await ensureNotificationPermission();
    if (granted) {
      await ensureNotificationChannelIfNeeded();
    }
    return granted;
  }, []);

  const getRestNotificationPermissionStatus = useCallback(async () => {
    const current = await Notifications.getPermissionsAsync();
    return current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }, []);

  const getRestNotificationPermissionSnapshot = useCallback(async (): Promise<RestNotificationPermissionSnapshot> => {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted || current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    return {
      granted,
      canAskAgain: current.canAskAgain,
      status: current.status,
    };
  }, []);

  const getRestExpoPushTokenSnapshot = useCallback(async (): Promise<RestExpoPushTokenSnapshot> => {
    const permission = await ensureNotificationPermission();
    const platform = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "unknown";
    if (!permission) {
      return {
        pushToken: null,
        platform,
      };
    }

    const projectId = resolveExpoProjectId();

    if (!projectId) {
      console.log(
        'Failed to get Expo push token: missing projectId. Add expo.extra.eas.projectId (or expo.extra.easProjectId) in app.json.'
      );
      return {
        pushToken: null,
        platform,
      };
    }

    try {
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined
      );
      return {
        pushToken: tokenResponse.data ?? null,
        platform,
      };
    } catch (error) {
      console.log("Failed to get Expo push token:", error);
      return {
        pushToken: null,
        platform,
      };
    }
  }, []);

  return {
    handleRestNotificationBridgeMessage,
    requestRestNotificationPermission,
    getRestNotificationPermissionStatus,
    getRestNotificationPermissionSnapshot,
    getRestExpoPushTokenSnapshot,
  };
}

function resolveExpoProjectId() {
  const extra = (Constants?.expoConfig?.extra ?? {}) as {
    eas?: { projectId?: string };
    easProjectId?: string;
  };

  return (
    extra.eas?.projectId?.trim() ||
    extra.easProjectId?.trim() ||
    Constants?.easConfig?.projectId?.trim() ||
    null
  );
}
