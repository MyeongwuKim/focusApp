import { useAuthStore } from "../stores";
import { getNativeWebViewBridge, isNativeWebViewRuntime } from "../utils/runtimeEnvironment";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getApiOrigin } from "./graphqlEndpoint";

type AuthProvider = "kakao" | "naver";

type NativeUnlinkResultPayload = {
  ok?: boolean;
  error?: string;
};

async function requestNativeProviderUnlink(provider: AuthProvider) {
  if (!isNativeWebViewRuntime()) {
    return;
  }

  const bridge = getNativeWebViewBridge();
  if (!bridge) {
    return;
  }

  const upperProvider = provider.toUpperCase();
  const requestId = `${provider}-native-unlink-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const resultType = `REST_AUTH_${upperProvider}_UNLINK_RESULT`;
  const requestType = `REST_AUTH_${upperProvider}_UNLINK_REQUEST`;
  const timeoutErrorCode = `NATIVE_${upperProvider}_UNLINK_TIMEOUT`;
  const failedErrorCode = `NATIVE_${upperProvider}_UNLINK_FAILED`;

  await new Promise<void>((resolve, reject) => {
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
    }, 12000);

    const handleBridgeEvent = (
      event: CustomEvent<{ type?: string; requestId?: string; payload?: NativeUnlinkResultPayload }>
    ) => {
      const detail = event.detail;
      if (detail?.type !== resultType || detail.requestId !== requestId) {
        return;
      }

      settled = true;
      cleanUp();

      const payload = detail.payload ?? {};
      if (payload.ok) {
        resolve();
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

export async function logout() {
  const { token, clearAuth } = useAuthStore.getState();
  const apiOrigin = getApiOrigin();
  const logoutUrl = apiOrigin ? `${apiOrigin}/auth/logout` : "/auth/logout";

  clearAuth();

  void Promise.allSettled([
    requestNativeProviderUnlink("kakao"),
    requestNativeProviderUnlink("naver"),
  ]).then((results) => {
    const [kakaoResult, naverResult] = results;
    if (kakaoResult?.status === "rejected") {
      console.warn("Native Kakao unlink failed. Continue with app logout.", kakaoResult.reason);
    }
    if (naverResult?.status === "rejected") {
      console.warn("Native Naver unlink failed. Continue with app logout.", naverResult.reason);
    }
  });

  if (token) {
    void fetchWithBackendStatus(logoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }
}
