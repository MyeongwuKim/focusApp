import { useMemo } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { fetchDailyLogByDate, fetchDailyLogMemo, fetchDailyLogsByMonth } from "../../api/dailyLogApi";

export const dailyLogsByMonthQueryKey = (monthKey: string) => ["daily-logs", monthKey] as const;
export const dailyLogByDateQueryKey = (dateKey: string) => ["daily-log-by-date", dateKey] as const;
export const dailyLogMemoQueryKey = (dateKey: string) => ["daily-log-memo", dateKey] as const;

export function dailyLogsByMonthQuery(monthKeys: string[]) {
  const dailyLogQueries = useQueries({
    queries: monthKeys.map((monthKey) => ({
      queryKey: dailyLogsByMonthQueryKey(monthKey),
      queryFn: () => fetchDailyLogsByMonth(monthKey),
      staleTime: 60 * 1000,
    })),
  });

  const monthlyLogs = useMemo(() => dailyLogQueries.flatMap((query) => query.data ?? []), [dailyLogQueries]);

  return {
    dailyLogQueries,
    monthlyLogs,
  };
}

export function dailyLogByDateQuery(dateKey: string | null) {
  return useQuery({
    queryKey: dailyLogByDateQueryKey(dateKey ?? ""),
    queryFn: () => fetchDailyLogByDate(dateKey as string),
    enabled: Boolean(dateKey),
    staleTime: 30 * 1000,
  });
}

export function dailyLogMemoQuery(dateKey: string | null) {
  return useQuery({
    queryKey: dailyLogMemoQueryKey(dateKey ?? ""),
    queryFn: () => fetchDailyLogMemo(dateKey as string),
    enabled: Boolean(dateKey),
    staleTime: 30 * 1000,
  });
}

export function useDailyLogQuery(input?: {
  monthKeys?: string[];
  dateKey?: string | null;
  memoDateKey?: string | null;
}) {
  const monthlyLogsQuery = dailyLogsByMonthQuery(input?.monthKeys ?? []);
  const dailyLogByDate = dailyLogByDateQuery(input?.dateKey ?? null);
  const dailyLogMemo = dailyLogMemoQuery(input?.memoDateKey ?? null);
  return {
    monthlyLogsQuery,
    dailyLogByDateQuery: dailyLogByDate,
    dailyLogMemoQuery: dailyLogMemo,
  };
}
