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

function ensureNotificationHandler() {
  if (notificationHandlerInitialized) {
    return;
  }

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
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

  return `/calendar?${next.toString()}`;
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

export function useRestNotificationBridge({ onNavigate }: UseRestNotificationBridgeInput) {
  const notificationIdByKeyRef = useRef<Map<string, string>>(new Map());
  const handledResponseIdRef = useRef<string | null>(null);

  useEffect(() => {
    ensureNotificationHandler();
  }, []);

  const handleNotificationResponseNavigation = useCallback(
    (response: Notifications.NotificationResponse | null) => {
      if (!response) {
        return;
      }

      const responseId = response.notification.request.identifier;
      if (handledResponseIdRef.current === responseId) {
        return;
      }
      handledResponseIdRef.current = responseId;

      const targetPath = response.notification.request.content.data?.targetPath;
      if (typeof targetPath === "string") {
        const normalizedPath = normalizeTargetPath(targetPath);
        if (normalizedPath) {
          onNavigate(normalizedPath);
        }
      }
    },
    [onNavigate]
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
