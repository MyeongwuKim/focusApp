export function notifyRestFinished(dateKey: string) {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return false;
  }

  if (Notification.permission !== "granted") {
    return false;
  }

  const notification = new Notification("휴식 종료", {
    body: "설정한 휴식 시간이 끝났어요. 눌러서 오늘 할일로 이동하세요.",
    tag: `rest-finished-${dateKey}`,
  });

  notification.onclick = () => {
    notification.close();
    window.focus();
    window.location.hash = `#/date-tasks?date=${dateKey}&restFinished=1`;
  };

  return true;
}

export type NativeNotificationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

export type NativeExpoPushTokenSnapshot = {
  pushToken: string | null;
  platform: "ios" | "android" | "unknown";
};

export type NativeLocationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  status: "granted" | "denied" | "undetermined" | "unsupported" | "unknown";
};

export type NativeLocationCoordinatesSnapshot = NativeLocationPermissionStatus & {
  coordinates: {
    latitude: number;
    longitude: number;
  } | null;
};

export async function requestNotificationPermission() {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return "unsupported" as const;
  }

  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }

  return Notification.requestPermission();
}

type RestNotificationBridgePayload = {
  key?: string;
  title?: string;
  body?: string;
  targetPath?: string;
  seconds?: number;
};

type NativeWebViewBridge = {
  postMessage: (message: string) => void;
};

export type NativeTodoSessionSyncPayload = {
  active: boolean;
  dateKey?: string | null;
  todoId?: string | null;
  startedAt?: string | null;
  sessionId?: string | null;
  syncedAtMs?: number;
};

export type NativeWeatherSettingsSyncPayload = {
  enabled: boolean;
  mood: "dreamy" | "cinematic";
  particleClarity: number;
};

function getNativeWebViewBridge(): NativeWebViewBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeBridge = (window as Window & { ReactNativeWebView?: NativeWebViewBridge }).ReactNativeWebView;
  if (!maybeBridge || typeof maybeBridge.postMessage !== "function") {
    return null;
  }

  return maybeBridge;
}

function postRestNotificationBridgeMessage(type: string, payload?: RestNotificationBridgePayload) {
  const bridge = getNativeWebViewBridge();
  if (!bridge) {
    return false;
  }

  bridge.postMessage(
    JSON.stringify({
      type,
      payload,
    })
  );
  return true;
}

function postNativeBridgeMessage(type: string, payload?: Record<string, unknown>) {
  const bridge = getNativeWebViewBridge();
  if (!bridge) {
    return false;
  }

  bridge.postMessage(JSON.stringify({ type, ...payload }));
  return true;
}

export function syncNativeTodoSession(payload: NativeTodoSessionSyncPayload) {
  return postNativeBridgeMessage("REST_TODO_SESSION_SYNC", { payload });
}

export function syncNativeWeatherSettings(payload: NativeWeatherSettingsSyncPayload) {
  return postNativeBridgeMessage("REST_WEATHER_SETTINGS_SYNC", { payload });
}

function getBrowserPermissionStatus(): NativeNotificationPermissionStatus {
  if (typeof window === "undefined" || typeof Notification === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  return {
    granted: Notification.permission === "granted",
    canAskAgain: Notification.permission === "default",
    status: Notification.permission,
  };
}

export async function getNotificationPermissionStatus(): Promise<NativeNotificationPermissionStatus> {
  if (typeof window === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  const requestId = `notif-status-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_NOTIFICATION_PERMISSION_STATUS_REQUEST", { requestId });
  if (!posted) {
    return getBrowserPermissionStatus();
  }

  return await new Promise<NativeNotificationPermissionStatus>((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve(getBrowserPermissionStatus());
    }, 1200);

    const handleBridgeEvent = (event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>) => {
      const detail = event.detail;
      if (
        detail?.type !== "REST_NOTIFICATION_PERMISSION_STATUS_RESULT" ||
        detail.requestId !== requestId ||
        !detail.payload ||
        typeof detail.payload !== "object"
      ) {
        return;
      }
      const payload = detail.payload as Partial<NativeNotificationPermissionStatus>;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        granted: Boolean(payload.granted),
        canAskAgain: Boolean(payload.canAskAgain),
        status: typeof payload.status === "string" ? payload.status : "unknown",
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
  });
}

function getBrowserLocationPermissionStatus(): NativeLocationPermissionStatus {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  return {
    granted: false,
    canAskAgain: true,
    status: "undetermined",
  };
}

async function refineLocationStatusFromWeb(
  current: NativeLocationPermissionStatus
): Promise<NativeLocationPermissionStatus> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return current;
  }

  if (!("permissions" in navigator) || typeof navigator.permissions?.query !== "function") {
    return current;
  }

  try {
    const permission = await navigator.permissions.query({ name: "geolocation" as PermissionName });
    if (permission.state === "granted") {
      return { granted: true, canAskAgain: true, status: "granted" };
    }
    if (permission.state === "denied") {
      return { granted: false, canAskAgain: false, status: "denied" };
    }
    return { granted: false, canAskAgain: true, status: "undetermined" };
  } catch {
    return current;
  }
}

export async function getLocationPermissionStatus(): Promise<NativeLocationPermissionStatus> {
  if (typeof window === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  const requestId = `location-status-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_LOCATION_PERMISSION_STATUS_REQUEST", { requestId });
  if (!posted) {
    return refineLocationStatusFromWeb(getBrowserLocationPermissionStatus());
  }

  return await new Promise<NativeLocationPermissionStatus>((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      void refineLocationStatusFromWeb(getBrowserLocationPermissionStatus()).then(resolve);
    }, 1200);

    const handleBridgeEvent = (
      event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>
    ) => {
      const detail = event.detail;
      if (
        detail?.type !== "REST_LOCATION_PERMISSION_STATUS_RESULT" ||
        detail.requestId !== requestId ||
        !detail.payload ||
        typeof detail.payload !== "object"
      ) {
        return;
      }
      const payload = detail.payload as Partial<NativeLocationPermissionStatus>;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      const baseStatus: NativeLocationPermissionStatus = {
        granted: Boolean(payload.granted),
        canAskAgain: Boolean(payload.canAskAgain),
        status:
          payload.status === "granted" || payload.status === "denied" || payload.status === "undetermined"
            ? payload.status
            : "unknown",
      };
      if (baseStatus.status === "undetermined" || baseStatus.status === "unknown") {
        void refineLocationStatusFromWeb(baseStatus).then(resolve);
        return;
      }
      resolve(baseStatus);
    };

    window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
  });
}

export async function getNativeLocationCoordinates(): Promise<NativeLocationCoordinatesSnapshot | null> {
  if (typeof window === "undefined") {
    return null;
  }

  const requestId = `location-coordinates-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_LOCATION_COORDINATES_REQUEST", { requestId });
  if (!posted) {
    return null;
  }

  return await new Promise<NativeLocationCoordinatesSnapshot | null>((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve(null);
    }, 1800);

    const handleBridgeEvent = (
      event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>
    ) => {
      const detail = event.detail;
      if (
        detail?.type !== "REST_LOCATION_COORDINATES_RESULT" ||
        detail.requestId !== requestId ||
        !detail.payload ||
        typeof detail.payload !== "object"
      ) {
        return;
      }

      const payload = detail.payload as Partial<NativeLocationCoordinatesSnapshot>;
      const status =
        payload.status === "granted" ||
        payload.status === "denied" ||
        payload.status === "undetermined" ||
        payload.status === "unsupported"
          ? payload.status
          : "unknown";
      const hasCoordinates =
        payload.coordinates &&
        typeof payload.coordinates === "object" &&
        typeof (payload.coordinates as { latitude?: unknown }).latitude === "number" &&
        typeof (payload.coordinates as { longitude?: unknown }).longitude === "number";

      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        granted: Boolean(payload.granted),
        canAskAgain: Boolean(payload.canAskAgain),
        status,
        coordinates: hasCoordinates
          ? {
              latitude: (payload.coordinates as { latitude: number }).latitude,
              longitude: (payload.coordinates as { longitude: number }).longitude,
            }
          : null,
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
  });
}

export function openAppPermissionSettings() {
  const posted = postNativeBridgeMessage("REST_APP_OPEN_SETTINGS");
  if (posted) {
    return true;
  }
  return false;
}

export async function getNativeExpoPushToken(): Promise<NativeExpoPushTokenSnapshot> {
  if (typeof window === "undefined") {
    return {
      pushToken: null,
      platform: "unknown",
    };
  }

  const requestId = `expo-push-token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_PUSH_TOKEN_REQUEST", { requestId });
  if (!posted) {
    return {
      pushToken: null,
      platform: "unknown",
    };
  }

  return await new Promise<NativeExpoPushTokenSnapshot>((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        pushToken: null,
        platform: "unknown",
      });
    }, 2500);

    const handleBridgeEvent = (event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>) => {
      const detail = event.detail;
      if (
        detail?.type !== "REST_PUSH_TOKEN_RESULT" ||
        detail.requestId !== requestId ||
        !detail.payload ||
        typeof detail.payload !== "object"
      ) {
        return;
      }

      const payload = detail.payload as Partial<NativeExpoPushTokenSnapshot>;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        pushToken: typeof payload.pushToken === "string" && payload.pushToken.trim() ? payload.pushToken : null,
        platform:
          payload.platform === "ios" || payload.platform === "android" ? payload.platform : "unknown",
      });
    };

    window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
  });
}

export function scheduleNativeRestNotification(input: {
  dateKey: string;
  seconds: number;
  title?: string;
  body?: string;
}) {
  const seconds = Number.isFinite(input.seconds) ? Math.max(1, Math.floor(input.seconds)) : 1;
  return postRestNotificationBridgeMessage("REST_NOTIFICATION_SCHEDULE", {
    key: `rest-finished-${input.dateKey}`,
    title: input.title ?? "휴식 시간 종료",
    body: input.body ?? "설정한 휴식 시간이 끝났어요. 눌러서 오늘 할일로 이동하세요.",
    targetPath: `/date-tasks?date=${input.dateKey}&restFinished=1`,
    seconds,
  });
}

export function cancelNativeRestNotification(dateKey?: string) {
  return postRestNotificationBridgeMessage("REST_NOTIFICATION_CANCEL", {
    key: dateKey ? `rest-finished-${dateKey}` : undefined,
  });
}
