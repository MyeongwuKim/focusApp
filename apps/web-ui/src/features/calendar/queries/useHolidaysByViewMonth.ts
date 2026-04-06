import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { shiftMonth } from "../../../utils/calendar";
import { fetchKoreanHolidays, type HolidaysByDate } from "../../../utils/holidays";

export default function useHolidaysByViewMonth(viewMonth: Date) {
  const targetYears = useMemo(() => {
    const prevMonth = shiftMonth(viewMonth, -1);
    const nextMonth = shiftMonth(viewMonth, 1);
    return Array.from(new Set([viewMonth.getFullYear(), prevMonth.getFullYear(), nextMonth.getFullYear()]));
  }, [viewMonth]);

  const holidayQueries = useQueries({
    queries: targetYears.map((year) => ({
      queryKey: ["kr-holidays", year] as const,
      queryFn: () => fetchKoreanHolidays(year),
      staleTime: 24 * 60 * 60 * 1000,
    })),
  });

  const holidaysByDate = useMemo(
    () =>
      holidayQueries.reduce((acc, query) => {
        if (query.data) {
          Object.assign(acc, query.data);
        }
        return acc;
      }, {} as HolidaysByDate),
    [holidayQueries]
  );

  const hasError = holidayQueries.some((query) => query.isError);

  return {
    holidaysByDate,
    hasError,
  };
}
