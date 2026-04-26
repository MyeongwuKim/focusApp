import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast, useAuthStore } from "./stores";
import { getUserFacingErrorMessage } from "./utils/errorMessage";

type GlobalErrorMeta = {
  skipGlobalErrorToast?: boolean;
  globalErrorTitle?: string;
};

function isAuthExpiredLikeError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return message.includes("401") || message.includes("로그인") || message.includes("세션");
}

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const meta = (query.meta ?? {}) as GlobalErrorMeta;
      if (meta.skipGlobalErrorToast) {
        return;
      }
      if (isAuthExpiredLikeError(error)) {
        return;
      }
      if (!useAuthStore.getState().token) {
        return;
      }

      toast.error(getUserFacingErrorMessage(error), meta.globalErrorTitle ?? "요청 실패");
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const meta = (mutation.meta ?? {}) as GlobalErrorMeta & { useGlobalErrorToast?: boolean };
      if (!meta.useGlobalErrorToast || meta.skipGlobalErrorToast) {
        return;
      }
      if (isAuthExpiredLikeError(error)) {
        return;
      }
      if (!useAuthStore.getState().token) {
        return;
      }

      toast.error(getUserFacingErrorMessage(error), meta.globalErrorTitle ?? "요청 실패");
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 10 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
