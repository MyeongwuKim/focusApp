type NativeWebViewBridge = {
  postMessage: (message: string) => void;
};

declare global {
  interface Window {
    __HYBRID_APP_SCHEME__?: string;
  }
}

const DEFAULT_NATIVE_APP_SCHEME = "mobile";

function hasWindow() {
  return typeof window !== "undefined";
}

function normalizeNativeAppScheme(rawScheme: unknown) {
  if (typeof rawScheme !== "string") {
    return "";
  }

  const scheme = rawScheme
    .trim()
    .replace(/:\/\/.*$/, "")
    .replace(/:$/, "")
    .toLowerCase();
  return /^[a-z][a-z0-9+.-]*$/.test(scheme) ? scheme : "";
}

export function getNativeWebViewBridge(): NativeWebViewBridge | null {
  if (!hasWindow()) {
    return null;
  }

  const maybeBridge = (window as Window & { ReactNativeWebView?: NativeWebViewBridge }).ReactNativeWebView;
  if (!maybeBridge || typeof maybeBridge.postMessage !== "function") {
    return null;
  }

  return maybeBridge;
}

export function isNativeWebViewRuntime() {
  return hasWindow() && window.location.protocol === "file:" && Boolean(getNativeWebViewBridge());
}

export function getNativeAppScheme() {
  if (!hasWindow()) {
    return DEFAULT_NATIVE_APP_SCHEME;
  }

  return normalizeNativeAppScheme(window.__HYBRID_APP_SCHEME__) || DEFAULT_NATIVE_APP_SCHEME;
}
