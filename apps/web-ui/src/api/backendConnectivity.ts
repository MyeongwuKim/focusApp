export type BackendConnectivityState = "online" | "offline";

type BackendConnectivityListener = (
  next: BackendConnectivityState,
  previous: BackendConnectivityState
) => void;

let backendConnectivityState: BackendConnectivityState = "online";
const listeners = new Set<BackendConnectivityListener>();

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
