import { useMemo } from "react";
import { useInfiniteQuery, useQueries, useQuery } from "@tanstack/react-query";
import {
  fetchDailyLogByDate,
  fetchDailyLogMemo,
  fetchDailyLogsByMonth,
  fetchDailyLogsWithMemo,
} from "../../api/dailyLogApi";

export const dailyLogsByMonthQueryKey = (monthKey: string) => ["daily-logs", monthKey] as const;
export const dailyLogsWithMemoBaseQueryKey = ["daily-logs-with-memo"] as const;
export const dailyLogsWithMemoQueryKey = (input?: {
  limit?: number;
  monthKey?: string | null;
  search?: string | null;
  sortOrder?: "asc" | "desc";
}) => [...dailyLogsWithMemoBaseQueryKey, input ?? {}] as const;
export const dailyLogByDateQueryKey = (dateKey: string) => ["daily-log-by-date", dateKey] as const;
export const dailyLogMemoQueryKey = (dateKey: string) => ["daily-log-memo", dateKey] as const;
export const statsDailyDetailQueryKey = (dateKey: string) => ["stats-daily-detail", dateKey] as const;

type MonthlyLogsQueryOptions = {
  enabled?: boolean;
  staleTime?: number;
  gcTime?: number;
  refetchOnMount?: boolean;
  refetchOnWindowFocus?: boolean;
};

function useDailyLogsByMonthQuery(monthKeys: string[], options?: MonthlyLogsQueryOptions) {
  const enabled = options?.enabled ?? true;
  const dailyLogQueries = useQueries({
    queries: monthKeys.map((monthKey) => ({
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      queryFn: () => fetchDailyLogsByMonth(monthKey),
      staleTime: options?.staleTime ?? 60 * 1000,
      gcTime: options?.gcTime,
      enabled: enabled && Boolean(monthKey),
      refetchOnMount: options?.refetchOnMount,
      refetchOnWindowFocus: options?.refetchOnWindowFocus,
    })),
  });

  const monthlyLogs = useMemo(() => dailyLogQueries.flatMap((query) => query.data ?? []), [dailyLogQueries]);

  return {
    dailyLogQueries,
    monthlyLogs,
  };
}

function useDailyLogByDateQuery(dateKey: string | null) {
  return useQuery({
    queryKey: dailyLogByDateQueryKey(dateKey ?? ""),
    queryFn: () => fetchDailyLogByDate(dateKey as string),
    enabled: Boolean(dateKey),
    staleTime: 30 * 1000,
  });
}

function useDailyLogMemoQuery(dateKey: string | null) {
  return useQuery({
    queryKey: dailyLogMemoQueryKey(dateKey ?? ""),
    queryFn: () => fetchDailyLogMemo(dateKey as string),
    enabled: Boolean(dateKey),
    staleTime: 30 * 1000,
  });
}

export function useDailyLogsWithMemoQuery(input?: {
  limit?: number;
  monthKey?: string | null;
  search?: string | null;
  sortOrder?: "asc" | "desc";
}) {
  const limit = input?.limit ?? 30;
  const monthKey = input?.monthKey ?? null;
  const search = input?.search?.trim() || null;
  const sortOrder = input?.sortOrder ?? "desc";

  return useInfiniteQuery({
    queryKey: dailyLogsWithMemoQueryKey({ limit, monthKey, search, sortOrder }),
    queryFn: ({ pageParam }) =>
      fetchDailyLogsWithMemo({
        limit,
        cursorDateKey: pageParam,
        monthKey,
        search,
        sortOrder,
      }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursorDateKey,
    staleTime: 30 * 1000,
  });
}

export function useDailyLogQuery(input?: {
  monthKeys?: string[];
  dateKey?: string | null;
  memoDateKey?: string | null;
  monthlyLogsOptions?: MonthlyLogsQueryOptions;
}) {
  const monthlyLogsQuery = useDailyLogsByMonthQuery(input?.monthKeys ?? [], input?.monthlyLogsOptions);
  const dailyLogByDate = useDailyLogByDateQuery(input?.dateKey ?? null);
  const dailyLogMemo = useDailyLogMemoQuery(input?.memoDateKey ?? null);
  return {
    monthlyLogsQuery,
    dailyLogByDateQuery: dailyLogByDate,
    dailyLogMemoQuery: dailyLogMemo,
  };
}
