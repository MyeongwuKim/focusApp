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
