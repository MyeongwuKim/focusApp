export type BackendConnectivityState = "online" | "offline";
const AUTH_EXPIRED_EVENT_NAME = "focus-hybrid-auth-expired";
const AUTH_EXPIRED_NOTIFY_COOLDOWN_MS = 1200;
const BACKEND_OFFLINE_CONFIRMATION_COUNT = 5;
const BACKEND_OFFLINE_CONFIRMATION_WINDOW_MS = 60000;

type BackendConnectivityListener = (
  next: BackendConnectivityState,
  previous: BackendConnectivityState
) => void;

let backendConnectivityState: BackendConnectivityState = "online";
const listeners = new Set<BackendConnectivityListener>();
let lastAuthExpiredNotifiedAt = 0;
let backendFailureCount = 0;
let firstBackendFailureAt = 0;

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
  const now = Date.now();
  if (!firstBackendFailureAt || now - firstBackendFailureAt > BACKEND_OFFLINE_CONFIRMATION_WINDOW_MS) {
    firstBackendFailureAt = now;
    backendFailureCount = 1;
  } else {
    backendFailureCount += 1;
  }

  if (backendFailureCount >= BACKEND_OFFLINE_CONFIRMATION_COUNT) {
    updateBackendConnectivityState("offline");
  }
}

export function markBackendOnline() {
  backendFailureCount = 0;
  firstBackendFailureAt = 0;
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

function isBackendAvailabilityStatus(status: number) {
  return status === 502 || status === 503 || status === 504;
}

function extractStatusCodeFromError(error: unknown) {
  if (!(error instanceof Error)) {
    return null;
  }

  const matched = error.message.match(/\b([1-5]\d{2})\b/);
  if (!matched?.[1]) {
    return null;
  }

  const parsed = Number(matched[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isBackendAvailabilityError(error: unknown) {
  if (isLikelyBackendOfflineError(error)) {
    return true;
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return true;
    }
    if (/timeout|timed out/i.test(error.message)) {
      return true;
    }
  }

  const statusCode = extractStatusCodeFromError(error);
  return statusCode !== null && isBackendAvailabilityStatus(statusCode);
}

export async function fetchWithBackendStatus(input: RequestInfo | URL, init?: RequestInit) {
  try {
    const response = await fetch(input, init);

    if (response.status === 401) {
      markBackendOnline();
      notifyAuthExpired();
      return response;
    }

    if (isBackendAvailabilityStatus(response.status)) {
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
