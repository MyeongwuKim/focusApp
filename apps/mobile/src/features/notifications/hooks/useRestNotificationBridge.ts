import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useRef } from "react";
import { Alert, Platform } from "react-native";

const REST_NOTIFICATION_CHANNEL_ID = "rest-reminder";
const DEFAULT_REST_NOTIFICATION_TITLE = "휴식 시간 종료";
const DEFAULT_REST_NOTIFICATION_BODY = "집중으로 돌아갈 시간입니다.";
const BRIDGE_NOTIFICATION_TYPES = {
  schedule: "REST_NOTIFICATION_SCHEDULE",
  cancel: "REST_NOTIFICATION_CANCEL",
  requestPermission: "REST_NOTIFICATION_PERMISSION_REQUEST",
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

async function maybeRequestNotificationPermissionWithIntro() {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) {
    return true;
  }

  const isUndetermined =
    current.status === Notifications.PermissionStatus.UNDETERMINED ||
    current.ios?.status === Notifications.IosAuthorizationStatus.NOT_DETERMINED;
  if (!isUndetermined || !current.canAskAgain) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    Alert.alert("집중 알림 설정", "집중을 도와드릴 수 있게 휴식 종료/리마인드 알림을 보내도 될까요?", [
      {
        text: "나중에",
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: "좋아요",
        onPress: async () => {
          const granted = await ensureNotificationPermission();
          resolve(granted);
        },
      },
    ]);
  });
}

type UseRestNotificationBridgeInput = {
  onNavigate: (path: string) => void;
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

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      maybeRequestNotificationPermissionWithIntro()
        .then((granted) => {
          if (cancelled || !granted) {
            return;
          }
          ensureNotificationChannelIfNeeded().catch((error) => {
            console.log("Failed to ensure notification channel:", error);
          });
        })
        .catch((error) => {
          console.log("Failed to show notification intro:", error);
        });
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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
      if (typeof targetPath === "string" && targetPath.startsWith("/")) {
        onNavigate(targetPath);
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
    const targetPath = asString(payload.targetPath) ?? (parsedDateKey ? `/date-tasks?date=${parsedDateKey}` : "/date-tasks");

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

  return {
    handleRestNotificationBridgeMessage,
  };
}
