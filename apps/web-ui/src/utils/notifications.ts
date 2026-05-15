import { getNativeWebViewBridge, postNativeBridgeMessage } from "./nativeBridge";

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
    window.location.hash = `#/calendar?sheet=1&date=${dateKey}&restFinished=1`;
  };

  return true;
}

export type NativeNotificationPermissionStatus = {
  granted: boolean;
  canAskAgain: boolean;
  status: string;
};

type RestNotificationBridgePayload = {
  key?: string;
  title?: string;
  body?: string;
  targetPath?: string;
  seconds?: number;
};

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

export async function requestNotificationPermission(): Promise<NativeNotificationPermissionStatus> {
  if (typeof window === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  const requestId = `notif-request-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const posted = postNativeBridgeMessage("REST_NOTIFICATION_PERMISSION_REQUEST", { requestId });
  if (posted) {
    return await new Promise<NativeNotificationPermissionStatus>((resolve) => {
      let settled = false;

      const timeoutId = window.setTimeout(() => {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
        resolve(getBrowserPermissionStatus());
      }, 2500);

      const handleBridgeEvent = (event: CustomEvent<{ type?: string; requestId?: string; payload?: unknown }>) => {
        const detail = event.detail;
        if (
          detail?.type !== "REST_NOTIFICATION_PERMISSION_RESULT" ||
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

  if (typeof Notification === "undefined") {
    return {
      granted: false,
      canAskAgain: false,
      status: "unsupported",
    };
  }

  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }

  return getBrowserPermissionStatus();
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
    targetPath: `/calendar?sheet=1&date=${input.dateKey}&restFinished=1`,
    seconds,
  });
}

export function cancelNativeRestNotification(dateKey?: string) {
  return postRestNotificationBridgeMessage("REST_NOTIFICATION_CANCEL", {
    key: dateKey ? `rest-finished-${dateKey}` : undefined,
  });
}

function buildFocusTargetElapsedNotificationKey(dateKey: string, todoId: string) {
  return `focus-target-elapsed-${dateKey}-${todoId}`;
}

export function scheduleNativeTargetFocusNotification(input: {
  dateKey: string;
  todoId: string;
  seconds: number;
  taskLabel?: string;
  targetFocusMinutes?: number | null;
}) {
  const seconds = Number.isFinite(input.seconds) ? Math.max(1, Math.floor(input.seconds)) : 1;
  const targetMinutes =
    typeof input.targetFocusMinutes === "number" && Number.isFinite(input.targetFocusMinutes)
      ? Math.max(Math.floor(input.targetFocusMinutes), 0)
      : null;
  const label = input.taskLabel?.trim() || "할일";
  const bodyBase = targetMinutes ? `${label}, ${targetMinutes}분 목표` : label;
  return postRestNotificationBridgeMessage("REST_NOTIFICATION_SCHEDULE", {
    key: buildFocusTargetElapsedNotificationKey(input.dateKey, input.todoId),
    title: "목표 집중시간 도달",
    body: `${bodyBase}. 이어가기 또는 완료를 선택해 주세요.`,
    targetPath: `/calendar?sheet=1&date=${input.dateKey}&focusTargetElapsed=1&todoId=${encodeURIComponent(input.todoId)}`,
    seconds,
  });
}

export function cancelNativeTargetFocusNotification(input: { dateKey: string; todoId: string }) {
  return postRestNotificationBridgeMessage("REST_NOTIFICATION_CANCEL", {
    key: buildFocusTargetElapsedNotificationKey(input.dateKey, input.todoId),
  });
}
