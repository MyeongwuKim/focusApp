import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  getBackendConnectivityState,
  isBackendAvailabilityError,
  isLikelyBackendOfflineError,
  markBackendOffline,
  markBackendOnline,
  subscribeAuthExpired,
  subscribeBackendConnectivity,
} from "../api/backendConnectivity";
import { getApiSessionScope } from "../api/graphqlEndpoint";
import { fetchMe } from "../api/userApi";
import { queryClient } from "../queryClient";
import { MAIN_ROUTE } from "../routes/route-config";
import type { RouteKey } from "../routes/types";
import { selectIsLoggedIn, toast, useAuthStore } from "../stores";
import { getUserFacingErrorMessage } from "../utils/errorMessage";

const BACKEND_RECHECK_MS = 3000;
const BACKEND_BOOT_MAX_ATTEMPTS = 5;
const BACKEND_BOOT_RETRY_MS = 5000;
const BACKEND_BOOT_TIMEOUT_MS = 45000;
const BACKEND_OFFLINE_BANNER_DELAY_MS = 3500;

export const LOGIN_ROUTE_PATH = "/login";
export const AUTH_CALLBACK_ROUTE_PATH = "/auth/callback";

type BackendBootStatus = "idle" | "checking" | "ready" | "error";

type BackendBootState = {
  status: BackendBootStatus;
  error: string | null;
  retryKey: number;
};

type BackendBootAction =
  | { type: "reset" }
  | { type: "checking" }
  | { type: "ready" }
  | { type: "error"; error: string }
  | { type: "setError"; error: string | null }
  | { type: "retry" };

const initialBackendBootState: BackendBootState = {
  status: "idle",
  error: null,
  retryKey: 0,
};

function backendBootReducer(state: BackendBootState, action: BackendBootAction): BackendBootState {
  switch (action.type) {
    case "reset":
      return { ...state, status: "idle", error: null };
    case "checking":
      return { ...state, status: "checking", error: null };
    case "ready":
      return { ...state, status: "ready", error: null };
    case "error":
      return { ...state, status: "error", error: action.error };
    case "setError":
      return { ...state, error: action.error };
    case "retry":
      return { ...state, retryKey: state.retryKey + 1 };
    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getCallbackParam(name: string, routeSearch: string): string | null {
  const fromRouteSearch = new URLSearchParams(routeSearch).get(name);
  if (fromRouteSearch) {
    return fromRouteSearch;
  }

  const fromWindowSearch = new URLSearchParams(window.location.search).get(name);
  if (fromWindowSearch) {
    return fromWindowSearch;
  }

  const hash = window.location.hash ?? "";
  const hashQueryIndex = hash.indexOf("?");
  if (hashQueryIndex >= 0) {
    const hashQuery = hash.slice(hashQueryIndex + 1);
    return new URLSearchParams(hashQuery).get(name);
  }

  return null;
}

function parseAuthProvider(rawValue: string | null) {
  if (rawValue === "apple" || rawValue === "kakao" || rawValue === "naver") {
    return rawValue;
  }
  return null;
}

function isLocalDevelopmentHost() {
  if (typeof window === "undefined") {
    return false;
  }

  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

type UseAuthSessionGuardOptions = {
  activeRoute: RouteKey;
  mainRoutePath: string;
};

export function useAuthSessionGuard({ activeRoute, mainRoutePath }: UseAuthSessionGuardOptions) {
  const location = useLocation();
  const navigate = useNavigate();
  const authToken = useAuthStore((state) => state.token);
  const authApiOrigin = useAuthStore((state) => state.apiOrigin);
  const isLoggedIn = useAuthStore(selectIsLoggedIn);
  const setAuthToken = useAuthStore((state) => state.setAuthToken);
  const setAuthProvider = useAuthStore((state) => state.setAuthProvider);
  const setAuthApiOrigin = useAuthStore((state) => state.setAuthApiOrigin);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [isAuthHydrated, setIsAuthHydrated] = useState(() => useAuthStore.persist.hasHydrated());
  const [backendBoot, dispatchBackendBoot] = useReducer(backendBootReducer, initialBackendBootState);
  const previousAuthTokenRef = useRef<string | null | undefined>(undefined);
  const backendOfflineBannerTimeoutRef = useRef<number | null>(null);
  const isLoginRoute = location.pathname === LOGIN_ROUTE_PATH;
  const isAuthCallbackRoute = location.pathname === AUTH_CALLBACK_ROUTE_PATH;
  const isAuthenticatedAppRoute = isLoggedIn && !isLoginRoute && !isAuthCallbackRoute;
  const backendBootState = backendBoot.status;
  const backendBootError = backendBoot.error;
  const backendBootRetryKey = backendBoot.retryKey;

  const hasAuthSessionScopeMismatch = useMemo(() => {
    if (!authToken) {
      return false;
    }

    if (!authApiOrigin) {
      return isLocalDevelopmentHost();
    }

    return authApiOrigin !== getApiSessionScope();
  }, [authApiOrigin, authToken]);

  const retryBackendBoot = useCallback(() => {
    dispatchBackendBoot({ type: "retry" });
  }, []);

  useEffect(() => {
    const unsubscribeOnHydrate = useAuthStore.persist.onHydrate(() => {
      setIsAuthHydrated(false);
    });
    const unsubscribeOnFinishHydration = useAuthStore.persist.onFinishHydration(() => {
      setIsAuthHydrated(true);
    });
    setIsAuthHydrated(useAuthStore.persist.hasHydrated());

    return () => {
      unsubscribeOnHydrate();
      unsubscribeOnFinishHydration();
    };
  }, []);

  useEffect(() => {
    const previousToken = previousAuthTokenRef.current;
    if (previousToken === undefined) {
      previousAuthTokenRef.current = authToken;
      return;
    }

    if (previousToken === authToken) {
      return;
    }

    previousAuthTokenRef.current = authToken;

    if (!authToken) {
      queryClient.clear();
      return;
    }

    void queryClient.invalidateQueries({ refetchType: "all" });
  }, [authToken]);

  useEffect(() => {
    if (!isAuthHydrated || !hasAuthSessionScopeMismatch) {
      return;
    }

    clearAuth();
    queryClient.clear();
  }, [clearAuth, hasAuthSessionScopeMismatch, isAuthHydrated]);

  useEffect(() => {
    if (isAuthCallbackRoute) {
      const token = getCallbackParam("token", location.search);
      if (token) {
        const provider = parseAuthProvider(getCallbackParam("provider", location.search));
        setAuthToken(token);
        setAuthApiOrigin(getApiSessionScope());
        setAuthProvider(provider);
        navigate(mainRoutePath, { replace: true });
        const fallbackNavigationTimeout = window.setTimeout(() => {
          if ((window.location.hash ?? "").includes("/auth/callback")) {
            window.location.hash = `#${mainRoutePath}`;
          }
        }, 250);
        return () => {
          window.clearTimeout(fallbackNavigationTimeout);
        };
      }

      navigate(LOGIN_ROUTE_PATH, { replace: true });
      const fallbackLoginTimeout = window.setTimeout(() => {
        if ((window.location.hash ?? "").includes("/auth/callback")) {
          window.location.hash = `#${LOGIN_ROUTE_PATH}`;
        }
      }, 250);
      return () => {
        window.clearTimeout(fallbackLoginTimeout);
      };
    }

    if (!isAuthHydrated) {
      return;
    }

    if (!isLoggedIn && !isLoginRoute) {
      navigate(LOGIN_ROUTE_PATH, { replace: true });
      return;
    }

    if (isLoggedIn && (location.pathname === "/" || isLoginRoute)) {
      navigate(mainRoutePath, { replace: true });
      return;
    }

    if (location.pathname === "/") {
      navigate(mainRoutePath, { replace: true });
      return;
    }

    if (
      isLoggedIn &&
      !isLoginRoute &&
      !isAuthCallbackRoute &&
      activeRoute === MAIN_ROUTE &&
      location.pathname !== mainRoutePath
    ) {
      navigate(mainRoutePath, { replace: true });
    }
  }, [
    activeRoute,
    isAuthCallbackRoute,
    isLoggedIn,
    isLoginRoute,
    location.pathname,
    location.search,
    mainRoutePath,
    navigate,
    isAuthHydrated,
    setAuthApiOrigin,
    setAuthProvider,
    setAuthToken,
  ]);

  useEffect(() => {
    if (!isAuthenticatedAppRoute || hasAuthSessionScopeMismatch) {
      dispatchBackendBoot({ type: "reset" });
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => {
      abortController.abort();
    }, BACKEND_BOOT_TIMEOUT_MS);

    dispatchBackendBoot({ type: "checking" });

    void (async () => {
      try {
        let attemptCount = 0;

        while (!cancelled && attemptCount < BACKEND_BOOT_MAX_ATTEMPTS) {
          attemptCount += 1;

          try {
            const me = await fetchMe({ signal: abortController.signal });
            if (cancelled) {
              return;
            }
            if (!me) {
              setAuthToken(null);
              return;
            }
            setAuthApiOrigin(getApiSessionScope());
            dispatchBackendBoot({ type: "ready" });
            markBackendOnline();
            return;
          } catch (error) {
            if (cancelled) {
              return;
            }

            if (!isBackendAvailabilityError(error)) {
              dispatchBackendBoot({
                type: "error",
                error: getUserFacingErrorMessage(error, "서버 연결에 실패했어요."),
              });
              if (isLikelyBackendOfflineError(error)) {
                markBackendOffline();
              }
              return;
            }

            markBackendOffline();
            if (attemptCount >= BACKEND_BOOT_MAX_ATTEMPTS || abortController.signal.aborted) {
              dispatchBackendBoot({
                type: "error",
                error: getUserFacingErrorMessage(error, "서버 연결에 실패했어요."),
              });
              return;
            }

            await wait(BACKEND_BOOT_RETRY_MS);
          }
        }
      } finally {
        window.clearTimeout(timeoutId);
      }
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      abortController.abort();
    };
  }, [
    backendBootRetryKey,
    hasAuthSessionScopeMismatch,
    isAuthenticatedAppRoute,
    setAuthApiOrigin,
    setAuthToken,
  ]);

  useEffect(() => {
    return subscribeAuthExpired(() => {
      const { token, clearAuth } = useAuthStore.getState();
      if (!token) {
        return;
      }

      clearAuth();
      toast.error("세션이 만료되어 로그아웃되었어요. 다시 로그인해 주세요.", "세션 만료");
    });
  }, []);

  useEffect(() => {
    if (!isAuthenticatedAppRoute || hasAuthSessionScopeMismatch) {
      return;
    }

    const clearOfflineBannerTimeout = () => {
      if (backendOfflineBannerTimeoutRef.current === null) {
        return;
      }
      window.clearTimeout(backendOfflineBannerTimeoutRef.current);
      backendOfflineBannerTimeoutRef.current = null;
    };

    const scheduleOfflineBanner = () => {
      clearOfflineBannerTimeout();
      backendOfflineBannerTimeoutRef.current = window.setTimeout(() => {
        backendOfflineBannerTimeoutRef.current = null;
        if (getBackendConnectivityState() !== "offline") {
          return;
        }
        dispatchBackendBoot({ type: "error", error: "서버 연결에 실패했어요." });
      }, BACKEND_OFFLINE_BANNER_DELAY_MS);
    };

    const unsubscribe = subscribeBackendConnectivity((next, previous) => {
      if (next === "offline") {
        if (backendBootState === "checking") {
          return;
        }
        scheduleOfflineBanner();
        return;
      }

      clearOfflineBannerTimeout();
      dispatchBackendBoot({ type: "ready" });
      if (previous === "offline") {
        void queryClient.resumePausedMutations();
        void queryClient.invalidateQueries();
        void queryClient.refetchQueries({ type: "active" });
      }
    });

    if (backendBootState !== "checking" && getBackendConnectivityState() === "offline") {
      scheduleOfflineBanner();
    }

    return () => {
      clearOfflineBannerTimeout();
      unsubscribe();
    };
  }, [backendBootState, hasAuthSessionScopeMismatch, isAuthenticatedAppRoute]);

  useEffect(() => {
    if (!isAuthenticatedAppRoute) {
      return;
    }
    if (getBackendConnectivityState() !== "offline") {
      return;
    }

    let cancelled = false;

    const probeBackend = async () => {
      try {
        const me = await fetchMe();
        if (cancelled) {
          return;
        }
        if (!me) {
          setAuthToken(null);
          return;
        }
        setAuthApiOrigin(getApiSessionScope());
        markBackendOnline();
      } catch (error) {
        if (cancelled) {
          return;
        }
        if (!isLikelyBackendOfflineError(error)) {
          dispatchBackendBoot({
            type: "setError",
            error: getUserFacingErrorMessage(error, "서버 연결에 실패했어요."),
          });
        }
      }
    };

    void probeBackend();
    const intervalId = window.setInterval(() => {
      void probeBackend();
    }, BACKEND_RECHECK_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    backendBootState,
    hasAuthSessionScopeMismatch,
    isAuthenticatedAppRoute,
    setAuthApiOrigin,
    setAuthToken,
  ]);

  return {
    authToken,
    isLoggedIn,
    isAuthCallbackRoute,
    hasAuthSessionScopeMismatch,
    backendBootState,
    backendBootError,
    retryBackendBoot,
  };
}
