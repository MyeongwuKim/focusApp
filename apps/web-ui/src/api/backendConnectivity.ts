export type BackendConnectivityState = "online" | "offline";
const AUTH_EXPIRED_EVENT_NAME = "focus-hybrid-auth-expired";
const AUTH_EXPIRED_NOTIFY_COOLDOWN_MS = 1200;

type BackendConnectivityListener = (
  next: BackendConnectivityState,
  previous: BackendConnectivityState
) => void;

let backendConnectivityState: BackendConnectivityState = "online";
const listeners = new Set<BackendConnectivityListener>();
let lastAuthExpiredNotifiedAt = 0;

function updateBackendConnectivityState(next: BackendConnectivityState) {
  if (backendConnectivityState === next) {
    return;
  }

  const previous = backendConnectivityState;
  backendConnectivityState = next;
  listeners.forEach((listener) => listener(next, previous));
}

export function getBackendConnectivityState() {
  return backendConnectivityState;
}

export function subscribeBackendConnectivity(listener: BackendConnectivityListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function markBackendOffline() {
  updateBackendConnectivityState("offline");
}

export function markBackendOnline() {
  updateBackendConnectivityState("online");
}

function notifyAuthExpired() {
  if (typeof window === "undefined") {
    return;
  }

  const now = Date.now();
  if (now - lastAuthExpiredNotifiedAt < AUTH_EXPIRED_NOTIFY_COOLDOWN_MS) {
    return;
  }

  lastAuthExpiredNotifiedAt = now;
  window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT_NAME));
}

export function subscribeAuthExpired(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const eventListener = () => {
    listener();
  };
  window.addEventListener(AUTH_EXPIRED_EVENT_NAME, eventListener);

  return () => {
    window.removeEventListener(AUTH_EXPIRED_EVENT_NAME, eventListener);
  };
}

export function isLikelyBackendOfflineError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const name = "name" in error ? String(error.name ?? "") : "";
  if (name === "AbortError") {
    return false;
  }

  const message = "message" in error ? String(error.message ?? "").toLowerCase() : "";
  if (!message) {
    return true;
  }

  return [
    "failed to fetch",
    "fetch failed",
    "networkerror",
    "network request failed",
    "load failed",
    "err_connection",
  ].some((token) => message.includes(token));
}

export async function fetchWithBackendStatus(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetch(input, init);

    if (response.status === 401) {
      markBackendOnline();
      notifyAuthExpired();
      return response;
    }

    if (response.status >= 500) {
      markBackendOffline();
    } else {
      markBackendOnline();
    }

    return response;
  } catch (error) {
    if (isLikelyBackendOfflineError(error)) {
      markBackendOffline();
    }
    throw error;
  }
}
