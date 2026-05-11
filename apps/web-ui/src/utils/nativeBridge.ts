type NativeWebViewBridge = {
  postMessage: (message: string) => void;
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

export type NativeAppVersionInfo = {
  appVersion: string | null;
  webUiVersion: string | null;
  webUiChannel: "dev" | "prod" | "none" | "unknown";
  platform: "ios" | "android" | "web" | "unknown";
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

export type NativeAuthStateSyncPayload = {
  loggedIn: boolean;
};

export function getNativeWebViewBridge(): NativeWebViewBridge | null {
  if (typeof window === "undefined") {
    return null;
  }

  const maybeBridge = (window as Window & { ReactNativeWebView?: NativeWebViewBridge }).ReactNativeWebView;
  if (!maybeBridge || typeof maybeBridge.postMessage !== "function") {
    return null;
  }

  return maybeBridge;
}

export function postNativeBridgeMessage(type: string, payload?: Record<string, unknown>) {
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

export function syncNativeAuthState(payload: NativeAuthStateSyncPayload) {
  return postNativeBridgeMessage("REST_AUTH_STATE_SYNC", { payload });
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

export async function requestLocationPermission(): Promise<NativeLocationPermissionStatus> {
  if (typeof window === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  const requestId = `location-request-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_LOCATION_PERMISSION_REQUEST", { requestId });
  if (posted) {
    return await new Promise<NativeLocationPermissionStatus>((resolve) => {
      let settled = false;

      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
        void refineLocationStatusFromWeb(getBrowserLocationPermissionStatus()).then(resolve);
      }, 15000);

      const handleBridgeEvent = (
        event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>
      ) => {
        const detail = event.detail;
        if (
          detail?.type !== "REST_LOCATION_PERMISSION_RESULT" ||
          detail.requestId !== requestId ||
          !detail.payload ||
          typeof detail.payload !== "object"
        ) {
          return;
        }

        const payload = detail.payload as Partial<NativeLocationPermissionStatus>;
        const baseStatus: NativeLocationPermissionStatus = {
          granted: Boolean(payload.granted),
          canAskAgain: Boolean(payload.canAskAgain),
          status:
            payload.status === "granted" ||
            payload.status === "denied" ||
            payload.status === "undetermined" ||
            payload.status === "unsupported"
              ? payload.status
              : "unknown",
        };

        settled = true;
        window.clearTimeout(timeoutId);
        window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
        if (baseStatus.status === "undetermined" || baseStatus.status === "unknown") {
          void refineLocationStatusFromWeb(baseStatus).then(resolve);
          return;
        }
        resolve(baseStatus);
      };

      window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
    });
  }

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  await new Promise<void>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve(),
      () => resolve(),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 0 }
    );
  });

  return await refineLocationStatusFromWeb(getBrowserLocationPermissionStatus());
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

export async function getNativeAppVersionInfo(): Promise<NativeAppVersionInfo> {
  if (typeof window === "undefined") {
    return {
      appVersion: null,
      webUiVersion: null,
      webUiChannel: "unknown",
      platform: "unknown",
    };
  }

  const requestId = `app-version-info-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_APP_VERSION_INFO_REQUEST", { requestId });
  if (!posted) {
    return {
      appVersion: null,
      webUiVersion: null,
      webUiChannel: "unknown",
      platform: "web",
    };
  }

  return await new Promise<NativeAppVersionInfo>((resolve) => {
    let settled = false;

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        appVersion: null,
        webUiVersion: null,
        webUiChannel: "unknown",
        platform: "unknown",
      });
    }, 1800);

    const handleBridgeEvent = (event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>) => {
      const detail = event.detail;
      if (
        detail?.type !== "REST_APP_VERSION_INFO_RESULT" ||
        detail.requestId !== requestId ||
        !detail.payload ||
        typeof detail.payload !== "object"
      ) {
        return;
      }

      const payload = detail.payload as Partial<NativeAppVersionInfo>;
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        appVersion: typeof payload.appVersion === "string" && payload.appVersion.trim() ? payload.appVersion : null,
        webUiVersion:
          typeof payload.webUiVersion === "string" && payload.webUiVersion.trim()
            ? payload.webUiVersion
            : null,
        webUiChannel:
          payload.webUiChannel === "dev" ||
          payload.webUiChannel === "prod" ||
          payload.webUiChannel === "none"
            ? payload.webUiChannel
            : "unknown",
        platform: payload.platform === "ios" || payload.platform === "android" ? payload.platform : "unknown",
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

  return await new Promise<NativeExpoPushTokenSnapshot>((resolve) => {
    let settled = false;
    const requestId = `expo-push-token-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

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

    const posted = postNativeBridgeMessage("REST_PUSH_TOKEN_REQUEST", { requestId });
    if (!posted) {
      settled = true;
      window.clearTimeout(timeoutId);
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      resolve({
        pushToken: null,
        platform: "unknown",
      });
    }
  });
}
