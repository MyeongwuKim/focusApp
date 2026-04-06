import { useQuery } from "@tanstack/react-query";
import { fetchDailyLogByDate } from "../api/dailyLogApi";

export const dailyLogByDateQueryKey = (dateKey: string) => ["daily-log-by-date", dateKey] as const;

export function dailyLogByDateQuery(dateKey: string | null) {
  return useQuery({
    queryKey: dailyLogByDateQueryKey(dateKey ?? ""),
    queryFn: () => fetchDailyLogByDate(dateKey as string),
    enabled: Boolean(dateKey),
    staleTime: 30 * 1000,
  });
}
