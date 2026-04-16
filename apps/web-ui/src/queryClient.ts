import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "./stores";
import { getUserFacingErrorMessage } from "./utils/errorMessage";

type GlobalErrorMeta = {
  skipGlobalErrorToast?: boolean;
  globalErrorTitle?: string;
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const meta = (query.meta ?? {}) as GlobalErrorMeta;
      if (meta.skipGlobalErrorToast) {
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
