import { useState, type MouseEvent } from "react";
import { getApiOrigin } from "../api/graphqlEndpoint";
import { SiKakaotalk, SiNaver } from "react-icons/si";
import { getNativeWebViewBridge, isNativeWebViewRuntime } from "../utils/runtimeEnvironment";

type AuthProvider = "kakao" | "naver";

function buildOAuthStartUrl(provider: AuthProvider) {
  const apiOrigin = getApiOrigin();
  const redirectTo =
    isNativeWebViewRuntime() ? "mobile://auth/callback" : `${window.location.origin}/#/auth/callback`;
  const authStartPath = apiOrigin ? `${apiOrigin}/auth/${provider}/start` : `/auth/${provider}/start`;
  const url = new URL(authStartPath, window.location.origin);
  url.searchParams.set("redirectTo", redirectTo);
  return url.toString();
}

type NativeLoginResultPayload = {
  ok?: boolean;
  token?: string;
  userId?: string;
  error?: string;
};

async function requestNativeProviderLoginSession(provider: AuthProvider) {
  const bridge = getNativeWebViewBridge();
  if (!bridge) {
    throw new Error("NATIVE_BRIDGE_UNAVAILABLE");
  }

  const upperProvider = provider.toUpperCase();
  const requestId = `${provider}-native-login-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const resultType = `REST_AUTH_${upperProvider}_LOGIN_RESULT`;
  const requestType = `REST_AUTH_${upperProvider}_LOGIN_REQUEST`;
  const timeoutErrorCode = `NATIVE_${upperProvider}_LOGIN_TIMEOUT`;
  const failedErrorCode = `NATIVE_${upperProvider}_LOGIN_FAILED`;

  return await new Promise<{ token: string; userId: string | null }>((resolve, reject) => {
    let settled = false;

    const cleanUp = () => {
      window.removeEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
      window.clearTimeout(timeoutId);
    };

    const timeoutId = window.setTimeout(() => {
      if (settled) {
        return;
      }
      settled = true;
      cleanUp();
      reject(new Error(timeoutErrorCode));
    }, 20000);

    const handleBridgeEvent = (
      event: CustomEvent<{ type?: string; requestId?: string; payload?: NativeLoginResultPayload }>
    ) => {
      const detail = event.detail;
      if (detail?.type !== resultType || detail.requestId !== requestId) {
        return;
      }

      settled = true;
      cleanUp();

      const payload = detail.payload ?? {};
      if (payload.ok && typeof payload.token === "string" && payload.token.length > 0) {
        resolve({
          token: payload.token,
          userId: typeof payload.userId === "string" ? payload.userId : null,
        });
        return;
      }

      reject(new Error(payload.error || failedErrorCode));
    };

    window.addEventListener("focus-hybrid-native-bridge", handleBridgeEvent as EventListener);
    bridge.postMessage(
      JSON.stringify({
        type: requestType,
        requestId,
      })
    );
  });
}

function isNativeLoginCancelledError(provider: AuthProvider, error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const code = error.message.trim().toUpperCase();
  if (!code) {
    return false;
  }

  if (provider === "kakao") {
    return code.includes("KAKAO_NATIVE_LOGIN_CANCELLED") || code.includes("CANCEL");
  }

  if (provider === "naver") {
    return code.includes("NAVER_NATIVE_LOGIN_CANCELLED") || code.includes("CANCEL");
  }

  return false;
}

export function LoginPage() {
  const [isNativeKakaoLoading, setIsNativeKakaoLoading] = useState(false);
  const [isNativeNaverLoading, setIsNativeNaverLoading] = useState(false);

  const handleNativeProviderLoginClick = async (
    provider: AuthProvider,
    event: MouseEvent<HTMLAnchorElement>
  ) => {
    const inNativeWebView = isNativeWebViewRuntime();

    if (!inNativeWebView) {
      return;
    }

    const bridge = getNativeWebViewBridge();
    const isAlreadyLoading = provider === "kakao" ? isNativeKakaoLoading : isNativeNaverLoading;
    if (!bridge || isAlreadyLoading) {
      return;
    }

    event.preventDefault();
    if (provider === "kakao") {
      setIsNativeKakaoLoading(true);
    } else {
      setIsNativeNaverLoading(true);
    }

    try {
      const result = await requestNativeProviderLoginSession(provider);
      const params = new URLSearchParams();
      params.set("token", result.token);
      if (result.userId) {
        params.set("userId", result.userId);
      }
      params.set("provider", provider);
      window.location.hash = `#/auth/callback?${params.toString()}`;
    } catch (error) {
      if (isNativeLoginCancelledError(provider, error)) {
        console.log(`Native ${provider} login cancelled by user.`);
        return;
      }
      console.warn(`Native ${provider} login failed. Keep login page without web OAuth fallback.`, error);
      return;
    } finally {
      if (provider === "kakao") {
        setIsNativeKakaoLoading(false);
      } else {
        setIsNativeNaverLoading(false);
      }
    }
  };

  return (
    <main className="app-root bg-gradient-to-b from-base-200 via-base-100 to-base-200">
      <section className="app-shell mx-auto flex h-full w-full items-center justify-center overflow-hidden border border-base-300 bg-base-100/95 px-5 shadow-xl backdrop-blur">
        <div className="w-full max-w-sm rounded-2xl border border-base-300 bg-base-100 p-6 shadow-lg">
          <h1 className="text-center text-2xl font-semibold">로그인</h1>
          <p className="mt-2 text-center text-sm text-base-content/70">
            카카오 또는 네이버 계정으로 시작할 수 있어요.
          </p>

          <div className="mt-6 flex flex-col gap-3">
            <a
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#E6C200] bg-[#FEE500] px-4 py-3 text-sm font-semibold text-[#1A1A1A] transition hover:brightness-95"
              href={buildOAuthStartUrl("kakao")}
              onClick={(event) => {
                void handleNativeProviderLoginClick("kakao", event);
              }}
            >
              <SiKakaotalk size={18} />
              {isNativeKakaoLoading ? "카카오 로그인 중..." : "카카오로 로그인"}
            </a>
            <a
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#029C38] bg-[#03C75A] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-95"
              href={buildOAuthStartUrl("naver")}
              onClick={(event) => {
                void handleNativeProviderLoginClick("naver", event);
              }}
            >
              <SiNaver size={16} />
              {isNativeNaverLoading ? "네이버 로그인 중..." : "네이버로 로그인"}
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
