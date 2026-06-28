import {
  readBridgeRequestId,
  readBridgeType,
  type ParsedBridgeMessage,
  type SendBridgeResult,
} from "../types";

type NativeSessionResult = {
  token: string;
  userId: string;
};

type KakaoOAuthTokenLike = {
  accessToken?: string | null;
};

type AppleCredentialLike = {
  identityToken: string;
  fullName?: string | null;
};

export type AuthBridgeHandlerDeps = {
  sendBridgeResult: SendBridgeResult;
  hybridApiOrigin: string;
  requestNativeAppleCredential: () => Promise<AppleCredentialLike>;
  requestNativeNaverAccessToken: () => Promise<string>;
  requestNativeKakaoOAuthToken: () => Promise<KakaoOAuthTokenLike>;
  exchangeAppleIdentityTokenForSession: (input: {
    apiOrigin: string;
    identityToken: string;
    fullName?: string | null;
  }) => Promise<NativeSessionResult>;
  exchangeNaverAccessTokenForSession: (input: {
    apiOrigin: string;
    accessToken: string;
  }) => Promise<NativeSessionResult>;
  exchangeKakaoAccessTokenForSession: (input: {
    apiOrigin: string;
    accessToken: string;
  }) => Promise<NativeSessionResult>;
  unlinkNaverAccountWithTimeout: () => Promise<unknown>;
  unlinkKakaoAccountWithTimeout: () => Promise<unknown>;
  resolveNativeErrorCode: (error: unknown, fallbackCode: string) => string;
};

export async function handleAuthBridgeMessage(
  parsedData: ParsedBridgeMessage,
  deps: AuthBridgeHandlerDeps
): Promise<boolean> {
  const messageType = readBridgeType(parsedData);
  if (!messageType) {
    return false;
  }

  if (messageType === "REST_AUTH_NAVER_LOGIN_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    if (!requestId) {
      return true;
    }

    try {
      const accessToken = await deps.requestNativeNaverAccessToken();
      const session = await deps.exchangeNaverAccessTokenForSession({
        apiOrigin: deps.hybridApiOrigin,
        accessToken,
      });

      deps.sendBridgeResult({
        type: "REST_AUTH_NAVER_LOGIN_RESULT",
        requestId,
        payload: {
          ok: true,
          token: session.token,
          userId: session.userId,
        },
      });
    } catch (error) {
      console.log("Native Naver login bridge failed:", error);
      deps.sendBridgeResult({
        type: "REST_AUTH_NAVER_LOGIN_RESULT",
        requestId,
        payload: {
          ok: false,
          error: deps.resolveNativeErrorCode(error, "NAVER_NATIVE_LOGIN_FAILED"),
        },
      });
    }

    return true;
  }

  if (messageType === "REST_AUTH_APPLE_LOGIN_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    if (!requestId) {
      return true;
    }

    try {
      const credential = await deps.requestNativeAppleCredential();
      const session = await deps.exchangeAppleIdentityTokenForSession({
        apiOrigin: deps.hybridApiOrigin,
        identityToken: credential.identityToken,
        fullName: credential.fullName,
      });

      deps.sendBridgeResult({
        type: "REST_AUTH_APPLE_LOGIN_RESULT",
        requestId,
        payload: {
          ok: true,
          token: session.token,
          userId: session.userId,
        },
      });
    } catch (error) {
      console.log("Native Apple login bridge failed:", error);
      deps.sendBridgeResult({
        type: "REST_AUTH_APPLE_LOGIN_RESULT",
        requestId,
        payload: {
          ok: false,
          error: deps.resolveNativeErrorCode(error, "APPLE_NATIVE_LOGIN_FAILED"),
        },
      });
    }

    return true;
  }

  if (messageType === "REST_AUTH_KAKAO_LOGIN_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    if (!requestId) {
      return true;
    }

    try {
      const oauthToken = await deps.requestNativeKakaoOAuthToken();
      if (!oauthToken?.accessToken) {
        throw new Error("KAKAO_NATIVE_ACCESS_TOKEN_MISSING");
      }

      const session = await deps.exchangeKakaoAccessTokenForSession({
        apiOrigin: deps.hybridApiOrigin,
        accessToken: oauthToken.accessToken,
      });

      deps.sendBridgeResult({
        type: "REST_AUTH_KAKAO_LOGIN_RESULT",
        requestId,
        payload: {
          ok: true,
          token: session.token,
          userId: session.userId,
        },
      });
    } catch (error) {
      console.log("Native Kakao login bridge failed:", error);
      deps.sendBridgeResult({
        type: "REST_AUTH_KAKAO_LOGIN_RESULT",
        requestId,
        payload: {
          ok: false,
          error: deps.resolveNativeErrorCode(error, "KAKAO_NATIVE_LOGIN_FAILED"),
        },
      });
    }

    return true;
  }

  if (messageType === "REST_AUTH_NAVER_UNLINK_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    if (!requestId) {
      return true;
    }

    try {
      await deps.unlinkNaverAccountWithTimeout();
      deps.sendBridgeResult({
        type: "REST_AUTH_NAVER_UNLINK_RESULT",
        requestId,
        payload: {
          ok: true,
        },
      });
    } catch (error) {
      console.log("Native Naver unlink bridge failed:", error);
      deps.sendBridgeResult({
        type: "REST_AUTH_NAVER_UNLINK_RESULT",
        requestId,
        payload: {
          ok: false,
          error: error instanceof Error && error.message ? error.message : "NAVER_NATIVE_UNLINK_FAILED",
        },
      });
    }

    return true;
  }

  if (messageType === "REST_AUTH_KAKAO_UNLINK_REQUEST") {
    const requestId = readBridgeRequestId(parsedData);
    if (!requestId) {
      return true;
    }

    try {
      await deps.unlinkKakaoAccountWithTimeout();
      deps.sendBridgeResult({
        type: "REST_AUTH_KAKAO_UNLINK_RESULT",
        requestId,
        payload: {
          ok: true,
        },
      });
    } catch (error) {
      console.log("Native Kakao unlink bridge failed:", error);
      deps.sendBridgeResult({
        type: "REST_AUTH_KAKAO_UNLINK_RESULT",
        requestId,
        payload: {
          ok: false,
          error: error instanceof Error && error.message ? error.message : "KAKAO_NATIVE_UNLINK_FAILED",
        },
      });
    }

    return true;
  }

  return false;
}
