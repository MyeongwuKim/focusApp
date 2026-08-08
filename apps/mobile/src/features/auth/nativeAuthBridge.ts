import Constants from "expo-constants";
import * as AppleAuthentication from "expo-apple-authentication";
import { AppState, Platform } from "react-native";
import {
  login as loginWithKakaoTalk,
  unlink as unlinkKakao,
  type KakaoOAuthToken,
} from "@react-native-seoul/kakao-login";
import NaverLogin from "@react-native-seoul/naver-login";
import type { AuthBridgeHandlerDeps } from "../bridge/handlers/authBridgeHandlers";
import type { SendBridgeResult } from "../bridge/types";
import { normalizeNativeAppScheme } from "../webview/nativeWebViewNavigation";
import { resolveNativeErrorCode, resolveNativeErrorSignals } from "../../shared/nativeErrors";
import { readUnknownRecord, readUnknownString } from "../../shared/nativeValues";

const NATIVE_PROVIDER_LOGIN_TIMEOUT_MS = 35000;
const NATIVE_SESSION_EXCHANGE_TIMEOUT_MS = 30000;
const NATIVE_PROVIDER_FOREGROUND_CANCEL_GRACE_MS = 3000;
const NAVER_NATIVE_CONSUMER_KEY = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim() ?? "";
const NAVER_NATIVE_CONSUMER_SECRET = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim() ?? "";
const NAVER_NATIVE_URL_SCHEME = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim() ?? "";
const NATIVE_DISPLAY_NAME =
  typeof Constants.expoConfig?.extra?.nativeDisplayName === "string"
    ? Constants.expoConfig.extra.nativeDisplayName.trim()
    : "";
const NAVER_NATIVE_APP_NAME =
  process.env.EXPO_PUBLIC_NAVER_APP_NAME?.trim() ??
  (NATIVE_DISPLAY_NAME || Constants.expoConfig?.name?.trim() || "focus-hybrid");
const NAVER_DISABLE_APP_AUTH_IOS = process.env.EXPO_PUBLIC_NAVER_DISABLE_APP_AUTH_IOS === "true";

type AuthProvider = "apple" | "kakao" | "naver";
type NativeAppleCredential = {
  identityToken: string;
  fullName: string | null;
};
type NativeSessionResult = {
  token: string;
  userId: string;
};

let isNaverLoginInitialized = false;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, errorCode: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = setTimeout(() => reject(new Error(errorCode)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timeoutId);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timeoutId);
        reject(error);
      });
  });
}

function withForegroundResumeCancel<T>(promise: Promise<T>, errorCode: string): Promise<T> {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    return promise;
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let didLeaveForeground = AppState.currentState !== "active";
    let cancelTimerId: ReturnType<typeof setTimeout> | null = null;

    const clearCancelTimer = () => {
      if (cancelTimerId !== null) {
        clearTimeout(cancelTimerId);
        cancelTimerId = null;
      }
    };
    const cleanUp = () => {
      clearCancelTimer();
      subscription.remove();
    };
    const resolveOnce = (value: T) => {
      if (settled) return;
      settled = true;
      cleanUp();
      resolve(value);
    };
    const rejectOnce = (error: unknown) => {
      if (settled) return;
      settled = true;
      cleanUp();
      reject(error);
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      if (settled) return;
      if (nextState !== "active") {
        didLeaveForeground = true;
        clearCancelTimer();
        return;
      }
      if (!didLeaveForeground) return;

      clearCancelTimer();
      cancelTimerId = setTimeout(
        () => rejectOnce(new Error(errorCode)),
        NATIVE_PROVIDER_FOREGROUND_CANCEL_GRACE_MS
      );
    });

    promise.then(resolveOnce).catch(rejectOnce);
  });
}

function isNativeLoginCancelledError(error: unknown) {
  return resolveNativeErrorSignals(error).some(
    (signal) =>
      signal.includes("cancel") ||
      signal.includes("canceled") ||
      signal.includes("cancelled") ||
      signal.includes("usercancel")
  );
}

function formatAppleFullName(fullName: unknown) {
  const fullNameRecord = readUnknownRecord(fullName);
  if (!fullNameRecord) return null;

  const nickname = readUnknownString(fullNameRecord.nickname);
  if (nickname) return nickname;

  const parts = [
    readUnknownString(fullNameRecord.givenName),
    readUnknownString(fullNameRecord.middleName),
    readUnknownString(fullNameRecord.familyName),
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : null;
}

async function requestNativeAppleCredential(): Promise<NativeAppleCredential> {
  if (Platform.OS !== "ios") throw new Error("APPLE_NATIVE_UNSUPPORTED_PLATFORM");
  if (!(await AppleAuthentication.isAvailableAsync())) {
    throw new Error("APPLE_NATIVE_UNAVAILABLE");
  }

  try {
    const credential = await withTimeout(
      AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      }),
      NATIVE_PROVIDER_LOGIN_TIMEOUT_MS,
      "APPLE_NATIVE_LOGIN_TIMEOUT"
    );
    const identityToken = credential.identityToken?.trim();
    if (!identityToken) throw new Error("APPLE_NATIVE_IDENTITY_TOKEN_MISSING");
    return { identityToken, fullName: formatAppleFullName(credential.fullName) };
  } catch (error) {
    if (isNativeLoginCancelledError(error)) {
      throw new Error("APPLE_NATIVE_LOGIN_CANCELLED");
    }
    throw error;
  }
}

async function requestNativeKakaoOAuthToken(): Promise<KakaoOAuthToken> {
  try {
    return await withTimeout(
      withForegroundResumeCancel(loginWithKakaoTalk(), "KAKAO_NATIVE_LOGIN_CANCELLED"),
      NATIVE_PROVIDER_LOGIN_TIMEOUT_MS,
      "KAKAO_NATIVE_TALK_LOGIN_TIMEOUT"
    );
  } catch (error) {
    if (isNativeLoginCancelledError(error)) {
      throw new Error("KAKAO_NATIVE_LOGIN_CANCELLED");
    }
    throw error;
  }
}

function initializeNaverLoginSdk() {
  if (isNaverLoginInitialized) return;
  if (!NAVER_NATIVE_CONSUMER_KEY || !NAVER_NATIVE_CONSUMER_SECRET || !NAVER_NATIVE_URL_SCHEME) {
    throw new Error("NAVER_NATIVE_CONFIG_MISSING");
  }

  NaverLogin.initialize({
    appName: NAVER_NATIVE_APP_NAME,
    consumerKey: NAVER_NATIVE_CONSUMER_KEY,
    consumerSecret: NAVER_NATIVE_CONSUMER_SECRET,
    serviceUrlSchemeIOS: NAVER_NATIVE_URL_SCHEME,
    disableNaverAppAuthIOS: NAVER_DISABLE_APP_AUTH_IOS,
  });
  isNaverLoginInitialized = true;
}

async function requestNativeNaverAccessToken() {
  initializeNaverLoginSdk();
  const loginResult = await withTimeout(
    withForegroundResumeCancel(NaverLogin.login(), "NAVER_NATIVE_LOGIN_CANCELLED"),
    NATIVE_PROVIDER_LOGIN_TIMEOUT_MS,
    "NAVER_NATIVE_LOGIN_TIMEOUT"
  );
  if (loginResult.isSuccess) {
    const accessToken = loginResult.successResponse?.accessToken?.trim();
    if (accessToken) return accessToken;
    throw new Error("NAVER_NATIVE_ACCESS_TOKEN_MISSING");
  }
  if (loginResult.failureResponse?.isCancel) {
    throw new Error("NAVER_NATIVE_LOGIN_CANCELLED");
  }
  throw new Error(loginResult.failureResponse?.message?.trim() || "NAVER_NATIVE_LOGIN_FAILED");
}

async function exchangeNativeAccessTokenForSession(input: {
  endpoint: string;
  body: Record<string, unknown>;
  timeoutCode: string;
  httpCode: string;
  invalidResponseCode: string;
}): Promise<NativeSessionResult> {
  const response = await withTimeout(
    fetch(input.endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input.body),
    }),
    NATIVE_SESSION_EXCHANGE_TIMEOUT_MS,
    input.timeoutCode
  );
  if (!response.ok) throw new Error(`${input.httpCode}_${response.status}`);

  const parsed = (await response.json()) as { token?: unknown; userId?: unknown };
  if (typeof parsed.token !== "string" || typeof parsed.userId !== "string") {
    throw new Error(input.invalidResponseCode);
  }
  return { token: parsed.token, userId: parsed.userId };
}

function exchangeAppleIdentityTokenForSession(input: {
  apiOrigin: string;
  identityToken: string;
  fullName?: string | null;
}) {
  return exchangeNativeAccessTokenForSession({
    endpoint: `${input.apiOrigin}/auth/apple/native`,
    body: { identityToken: input.identityToken, fullName: input.fullName },
    timeoutCode: "APPLE_NATIVE_EXCHANGE_TIMEOUT",
    httpCode: "APPLE_NATIVE_AUTH_HTTP",
    invalidResponseCode: "APPLE_NATIVE_AUTH_INVALID_RESPONSE",
  });
}

function exchangeKakaoAccessTokenForSession(input: { apiOrigin: string; accessToken: string }) {
  return exchangeNativeAccessTokenForSession({
    endpoint: `${input.apiOrigin}/auth/kakao/native`,
    body: { accessToken: input.accessToken },
    timeoutCode: "KAKAO_NATIVE_EXCHANGE_TIMEOUT",
    httpCode: "KAKAO_NATIVE_AUTH_HTTP",
    invalidResponseCode: "KAKAO_NATIVE_AUTH_INVALID_RESPONSE",
  });
}

function exchangeNaverAccessTokenForSession(input: { apiOrigin: string; accessToken: string }) {
  return exchangeNativeAccessTokenForSession({
    endpoint: `${input.apiOrigin}/auth/naver/native`,
    body: { accessToken: input.accessToken },
    timeoutCode: "NAVER_NATIVE_EXCHANGE_TIMEOUT",
    httpCode: "NAVER_NATIVE_AUTH_HTTP",
    invalidResponseCode: "NAVER_NATIVE_AUTH_INVALID_RESPONSE",
  });
}

function unlinkKakaoAccountWithTimeout() {
  return withTimeout(unlinkKakao(), 10000, "KAKAO_NATIVE_UNLINK_TIMEOUT");
}

function unlinkNaverAccountWithTimeout() {
  initializeNaverLoginSdk();
  return withTimeout(NaverLogin.deleteToken(), 10000, "NAVER_NATIVE_UNLINK_TIMEOUT");
}

export function createNativeAuthBridgeDeps(input: {
  sendBridgeResult: SendBridgeResult;
  hybridApiOrigin: string;
}): AuthBridgeHandlerDeps {
  return {
    ...input,
    requestNativeAppleCredential,
    requestNativeNaverAccessToken,
    requestNativeKakaoOAuthToken,
    exchangeAppleIdentityTokenForSession,
    exchangeNaverAccessTokenForSession,
    exchangeKakaoAccessTokenForSession,
    unlinkNaverAccountWithTimeout,
    unlinkKakaoAccountWithTimeout,
    resolveNativeErrorCode,
  };
}

export function buildAuthCallbackHash(input: {
  token: string;
  userId?: string | null;
  provider?: AuthProvider | null;
  error?: string | null;
}) {
  const params = new URLSearchParams();
  params.set("token", input.token);
  if (input.userId) params.set("userId", input.userId);
  if (input.provider) params.set("provider", input.provider);
  if (input.error) params.set("error", input.error);
  return `#/auth/callback?${params.toString()}`;
}

function readCallbackValue(url: URL, key: string) {
  const fromSearch = url.searchParams.get(key);
  if (fromSearch) return fromSearch;

  const hashQueryIndex = (url.hash ?? "").indexOf("?");
  if (hashQueryIndex < 0) return null;
  return new URLSearchParams(url.hash.slice(hashQueryIndex + 1)).get(key);
}

export function resolveAuthCallbackHashFromUrl(rawUrl: string, nativeAppScheme: string) {
  try {
    const parsed = new URL(rawUrl);
    const looksLikeAuthCallback =
      normalizeNativeAppScheme(parsed.protocol) === nativeAppScheme ||
      rawUrl.includes("/auth/callback") ||
      parsed.hash.includes("/auth/callback") ||
      (parsed.protocol === "file:" && parsed.pathname.endsWith("/index.html"));
    if (!looksLikeAuthCallback) return null;

    const token = readCallbackValue(parsed, "token");
    if (!token) return null;

    const rawProvider = readCallbackValue(parsed, "provider");
    const provider: AuthProvider | null =
      rawProvider === "apple" || rawProvider === "kakao" || rawProvider === "naver"
        ? rawProvider
        : null;
    return buildAuthCallbackHash({
      token,
      userId: readCallbackValue(parsed, "userId"),
      provider,
      error: readCallbackValue(parsed, "error"),
    });
  } catch {
    return null;
  }
}

export function resolveProviderFromBridgeLoginResultType(type: string): AuthProvider | null {
  if (type === "REST_AUTH_APPLE_LOGIN_RESULT") return "apple";
  if (type === "REST_AUTH_KAKAO_LOGIN_RESULT") return "kakao";
  if (type === "REST_AUTH_NAVER_LOGIN_RESULT") return "naver";
  return null;
}
