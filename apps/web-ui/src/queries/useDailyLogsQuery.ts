import { useQuery } from "@tanstack/react-query";
import { fetchDailyLogsByMonth } from "../api/dailyLogApi";

export function dailyLogsByMonthQuery(monthKey: string) {
  return useQuery({
    queryKey: ["daily-logs", monthKey],
    queryFn: () => fetchDailyLogsByMonth(monthKey),
  });
}
