import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchDailyLogsByMonth } from "../api/dailyLogApi";

export const dailyLogsByMonthQueryKey = (monthKey: string) => ["daily-logs", monthKey] as const;

export default function useDailyLogsQuery(monthKeys: string[]) {
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
