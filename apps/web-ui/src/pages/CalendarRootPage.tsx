import { useMemo, useState } from "react";
import { CalendarPage } from "../features/calendar/components/CalendarPage";
import { FooterBar } from "../features/calendar/components/FooterBar";
import { PageHeader } from "../components/PageHeader";
import { MAIN_ROUTE } from "../routes/route-config";
import { shiftMonth } from "../utils/calendar";
import { formatDateKey } from "../utils/holidays";

import { useAppStore } from "../stores";
import { useDailyLogQuery } from "../queries";

type CalendarRootPageProps = {
  isOverlayActive: boolean;
};

function hasMeaningfulMemoContent(memo?: string | null) {
  if (!memo) {
    return false;
  }

  const text = memo
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text.length > 0;
}

export function CalendarRootPage({ isOverlayActive }: CalendarRootPageProps) {
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const [todayOpenSignal, setTodayOpenSignal] = useState(0);

  const monthKeys = useMemo(
    () =>
      [shiftMonth(viewMonth, -1), viewMonth, shiftMonth(viewMonth, 1)].map(
        (month) => `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`
      ),
    [viewMonth]
  );
  const { monthlyLogsQuery } = useDailyLogQuery({ monthKeys });
  const { monthlyLogs } = monthlyLogsQuery;

  const logsByDate = useMemo(() => {
    if (monthlyLogs.length === 0) {
      return {};
    }

    return monthlyLogs.reduce((acc, log) => {
      const sortedTodos = [...log.todos].sort((a, b) => a.order - b.order);
      acc[log.dateKey] = {
        todoCount: log.todoCount,
        doneCount: log.doneCount,
        allDone: log.todoCount > 0 && log.doneCount === log.todoCount,
        hasMemo: hasMeaningfulMemoContent(log.memo),
        previewBars: sortedTodos.map((todo) => ({
          id: todo.id,
          label: todo.content,
        })),
        tasks: sortedTodos.map((todo) => ({
          label: todo.content,
          done: todo.done,
        })),
      };
      return acc;
    }, {} as Record<
      string,
      {
        todoCount: number;
        doneCount: number;
        allDone: boolean;
        hasMemo: boolean;
        previewBars: { id: string; label: string }[];
        tasks: { label: string; done: boolean }[];
      }
    >);
  }, [monthlyLogs]);

  return (
    <>
      <PageHeader route={MAIN_ROUTE} />
      <CalendarPage logsByDate={logsByDate} isActive={!isOverlayActive} todayOpenSignal={todayOpenSignal} />
      <FooterBar
        onGoToday={() => {
          const now = new Date();
          setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
          setSelectedDateKey(formatDateKey(now));
          setTodayOpenSignal((prev) => prev + 1);
        }}
      />
    </>
  );
}
