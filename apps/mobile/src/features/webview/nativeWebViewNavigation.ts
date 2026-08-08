import Constants from "expo-constants";
import { Linking, NativeModules, Platform } from "react-native";

const DEFAULT_NATIVE_APP_SCHEME = "mobile";

export type NativeTodoViewSnapshot = {
  isViewingTodayTodoSurface: boolean;
  source: "date-tasks" | "calendar-sheet" | "none";
  dateKey: string | null;
  routePath: string | null;
};

export function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isLoopbackHost(host: string) {
  const normalized = host.trim().toLowerCase();
  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "::1" ||
    normalized === "[::1]"
  );
}

export function resolveHybridApiOrigin() {
  const envOrigin = process.env.EXPO_PUBLIC_API_ORIGIN ?? process.env.EXPO_PUBLIC_API_BASE_URL;
  if (envOrigin?.trim()) {
    return envOrigin
      .trim()
      .replace(/\/graphql\/?$/i, "")
      .replace(/\/+$/, "");
  }

  const scriptUrl = NativeModules.SourceCode?.scriptURL as string | undefined;
  if (scriptUrl) {
    const hostMatch = scriptUrl.match(/^[a-z]+:\/\/([^/:?#]+)/i);
    const host = hostMatch?.[1];
    if (host && !isLoopbackHost(host)) {
      return `http://${host}:4000`;
    }
  }

  const expoHostUri =
    (Constants.expoConfig as { hostUri?: string } | null)?.hostUri ??
    (Constants as { expoGoConfig?: { debuggerHost?: string } }).expoGoConfig?.debuggerHost ??
    null;
  const expoHost = expoHostUri?.split(":")[0];
  if (expoHost && !isLoopbackHost(expoHost)) {
    return `http://${expoHost}:4000`;
  }

  return "http://localhost:4000";
}

export function normalizeNativeAppScheme(rawScheme: unknown) {
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

export function resolveNativeAppScheme() {
  const expoScheme = Constants.expoConfig?.scheme;
  if (Array.isArray(expoScheme)) {
    const firstScheme = expoScheme.map(normalizeNativeAppScheme).find(Boolean);
    if (firstScheme) {
      return firstScheme;
    }
  }

  const normalizedExpoScheme = normalizeNativeAppScheme(expoScheme);
  if (normalizedExpoScheme) {
    return normalizedExpoScheme;
  }

  return normalizeNativeAppScheme(process.env.EXPO_PUBLIC_APP_SCHEME) || DEFAULT_NATIVE_APP_SCHEME;
}

export function resolveNativePlatform() {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : "unknown";
}

export function hasNativeAppProtocol(rawUrl: string, nativeAppScheme: string) {
  try {
    const parsed = new URL(rawUrl);
    return normalizeNativeAppScheme(parsed.protocol) === nativeAppScheme;
  } catch {
    return false;
  }
}

export function isMainFrameWebViewRequest(request: {
  url: string;
  isTopFrame?: boolean;
  mainDocumentURL?: string | null;
}) {
  if (typeof request.isTopFrame === "boolean") {
    return request.isTopFrame;
  }

  if (request.mainDocumentURL) {
    return request.mainDocumentURL === request.url;
  }

  return true;
}

function shouldKeepUrlInWebView(
  rawUrl: string,
  knownEntryUris: (string | null | undefined)[]
) {
  try {
    const parsed = new URL(rawUrl);
    if (
      parsed.protocol === "file:" ||
      parsed.protocol === "about:" ||
      parsed.protocol === "data:" ||
      parsed.protocol === "blob:"
    ) {
      return true;
    }

    return knownEntryUris.some((entryUri) => {
      if (!entryUri) {
        return false;
      }

      try {
        const entryUrl = new URL(entryUri);
        return parsed.origin === entryUrl.origin && parsed.pathname === entryUrl.pathname;
      } catch {
        return false;
      }
    });
  } catch {
    return true;
  }
}

export function shouldOpenUrlOutsideWebView(
  rawUrl: string,
  knownEntryUris: (string | null | undefined)[]
) {
  if (shouldKeepUrlInWebView(rawUrl, knownEntryUris)) {
    return false;
  }

  try {
    return Boolean(new URL(rawUrl).protocol);
  } catch {
    return false;
  }
}

export async function openUrlOutsideWebView(rawUrl: string) {
  try {
    await Linking.openURL(rawUrl);
  } catch (error) {
    console.log("Failed to open external WebView navigation:", rawUrl, error);
  }
}

export function buildWebUiUriWithHash(baseUri: string, callbackHash: string) {
  if (!callbackHash) {
    return baseUri;
  }
  const normalizedHash = callbackHash.startsWith("#") ? callbackHash : `#${callbackHash}`;
  return `${baseUri.split("#")[0]}${normalizedHash}`;
}

export function parseTodoViewSnapshotFromWebViewUrl(rawUrl: string): NativeTodoViewSnapshot {
  try {
    const parsed = new URL(rawUrl);
    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    const normalizedHash = hash.startsWith("/") ? hash : `/${hash}`;
    const [pathname, rawSearch = ""] = normalizedHash.split("?", 2);
    const searchParams = new URLSearchParams(rawSearch);
    const todayKey = formatLocalDateKey(new Date());

    if (pathname === "/date-tasks") {
      const dateKey = searchParams.get("date") ?? todayKey;
      return {
        isViewingTodayTodoSurface: dateKey === todayKey,
        source: "date-tasks",
        dateKey,
        routePath: normalizedHash,
      };
    }

    if (pathname === "/calendar" && searchParams.get("sheet") === "1") {
      const dateKey = searchParams.get("date") ?? todayKey;
      return {
        isViewingTodayTodoSurface: dateKey === todayKey,
        source: "calendar-sheet",
        dateKey,
        routePath: normalizedHash,
      };
    }
  } catch {
    // Invalid URLs are treated as an unknown WebView route.
  }

  return {
    isViewingTodayTodoSurface: false,
    source: "none",
    dateKey: null,
    routePath: null,
  };
}

export function convertCalendarSheetPathToDateTasksPath(targetPath: string) {
  if (!targetPath.startsWith("/calendar")) {
    return targetPath;
  }

  const [pathname, rawSearch = ""] = targetPath.split("?", 2);
  if (pathname !== "/calendar") {
    return targetPath;
  }

  const params = new URLSearchParams(rawSearch);
  if (params.get("sheet") !== "1") {
    return targetPath;
  }

  const dateKey = params.get("date");
  if (!dateKey) {
    return targetPath;
  }

  const next = new URLSearchParams();
  next.set("date", dateKey);
  if (params.get("restFinished") === "1") next.set("restFinished", "1");
  if (params.get("focusTargetElapsed") === "1") next.set("focusTargetElapsed", "1");
  if (params.get("startTodoPrompt") === "1") next.set("startTodoPrompt", "1");

  const copiedKeys = ["startTodoPromptSource", "promptAt", "todoId"] as const;
  for (const key of copiedKeys) {
    const value = params.get(key);
    if (value) next.set(key, value);
  }

  return `/date-tasks?${next.toString()}`;
}

export function resolveNativeRoutePathFromUrl(rawUrl: string, nativeAppScheme: string) {
  try {
    const parsed = new URL(rawUrl);
    if (normalizeNativeAppScheme(parsed.protocol) !== nativeAppScheme) {
      return null;
    }

    const focusPath = parsed.searchParams.get("focusPath");
    if (focusPath?.startsWith("/")) {
      return focusPath;
    }

    const hash = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hash.startsWith("/")) {
      return hash;
    }

    const hostPath = parsed.hostname ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname;
    const normalizedPath = hostPath.startsWith("/") ? hostPath : `/${hostPath}`;
    if (normalizedPath === "/" || normalizedPath === "/auth/callback") {
      return null;
    }

    return `${normalizedPath}${parsed.search}`;
  } catch {
    return null;
  }
}
