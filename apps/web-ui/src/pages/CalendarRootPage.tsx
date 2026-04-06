import { useMemo } from "react";
import { CalendarPage } from "../features/calendar/components/CalendarPage";
import { FooterBar } from "../features/calendar/components/FooterBar";
import { PageHeader } from "../components/PageHeader";
import { MAIN_ROUTE } from "../routes/route-config";
import { shiftMonth } from "../utils/calendar";

import { useAppStore } from "../stores";
import useDailyLogsQuery from "../queries/useDailyLogsQuery";

type CalendarRootPageProps = {
  isOverlayActive: boolean;
};

export function CalendarRootPage({ isOverlayActive }: CalendarRootPageProps) {
  const viewMonth = useAppStore((state) => state.viewMonth);

  const monthKeys = useMemo(
    () =>
      [shiftMonth(viewMonth, -1), viewMonth, shiftMonth(viewMonth, 1)].map(
        (month) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
      ),
    [viewMonth]
  );
  const { monthlyLogs } = useDailyLogsQuery(monthKeys);

  const logsByDate = useMemo(() => {
    if (monthlyLogs.length === 0) {
      return {};
    }

    return monthlyLogs.reduce((acc, log) => {
      const sortedTodos = [...log.todos].sort((a, b) => a.order - b.order);
      acc[log.dateKey] = {
        previewBars: sortedTodos.slice(0, 3).map((todo) => ({
          id: todo.id,
          label: todo.content,
        })),
        tasks: sortedTodos.map((todo) => ({
          label: todo.content,
          done: todo.done,
        })),
      };
      return acc;
    }, {} as Record<string, { previewBars: { id: string; label: string }[]; tasks: { label: string; done: boolean }[] }>);
  }, [monthlyLogs]);

  return (
    <>
      <PageHeader route={MAIN_ROUTE} />
      <CalendarPage logsByDate={logsByDate} isActive={!isOverlayActive} />
      <FooterBar />
    </>
  );
}
