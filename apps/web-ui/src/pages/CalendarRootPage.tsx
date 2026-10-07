import { useMemo } from "react";
import { CalendarPage } from "../features/calendar/components/CalendarPage";
import { PageHeader } from "../components/PageHeader";
import { shiftMonth } from "../utils/calendar";
import { useAppStore } from "../stores";
import { useDailyLogQuery } from "../queries";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { CALENDAR_DATE_TASKS_PATH } from "../routes/route-config";

type CalendarRootPageProps = {
  showHeader?: boolean;
};

function hasMeaningfulMemoContent(memo?: string | null) {
  return getMemoPreviewText(memo).length > 0;
}

function getMemoPreviewText(memo?: string | null) {
  if (!memo) {
    return "";
  }

  if (typeof DOMParser !== "undefined") {
    const parsed = new DOMParser().parseFromString(memo, "text/html");
    return (parsed.body.textContent ?? "").replace(/\s+/g, " ").trim();
  }

  return memo
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 월간 기록을 탐색하고 선택한 날짜의 일간 할 일 화면을 여는 캘린더 화면이다.
 * 날짜를 누르면 캘린더 상태를 유지한 채 전체 화면 일간 페이지를 위에 쌓는다.
 */
export function CalendarRootPage({ showHeader = true }: CalendarRootPageProps) {
  const { goPage } = useAppNavigation();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);

  const monthKeys = useMemo(
    () => {
      const keys = [-2, -1, 0, 1, 2].map((offset) => {
        const month = shiftMonth(viewMonth, offset);
        return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
      });
      return Array.from(new Set(keys));
    },
    [viewMonth]
  );
  const { monthlyLogsQuery } = useDailyLogQuery({
    monthKeys,
    monthlyLogsOptions: {
      staleTime: 0,
      refetchOnMount: "always",
      refetchOnWindowFocus: true,
    },
  });
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
      }
    >);
  }, [monthlyLogs]);

  /** 선택한 날짜를 저장하고 캘린더 위에 해당 날짜의 일간 할 일 페이지를 연다. */
  const openDateTasksPage = (dateKey: string) => {
    setSelectedDateKey(dateKey);
    goPage(CALENDAR_DATE_TASKS_PATH, {
      query: { date: dateKey },
    });
  };

  return (
    <div className="calendar-root-page relative flex min-h-0 flex-1 flex-col">
      {showHeader ? <PageHeader route="calendar" /> : null}
      <div className="flex min-h-0 flex-1 flex-col pb-[var(--app-safe-area-bottom)]">
        <CalendarPage
          logsByDate={logsByDate}
          onOpenDateTasks={openDateTasksPage}
        />
      </div>
    </div>
  );
}
