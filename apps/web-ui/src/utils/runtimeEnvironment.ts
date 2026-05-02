type NativeWebViewBridge = {
  postMessage: (message: string) => void;
};

function hasWindow() {
  return typeof window !== "undefined";
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

