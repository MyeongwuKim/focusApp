import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { CalendarPage } from "../features/calendar/components/CalendarPage";
import { DateTasksBottomSheet } from "../features/calendar/components/DateTasksBottomSheet";
import { PageHeader } from "../components/PageHeader";
import { MAIN_ROUTE } from "../routes/route-config";
import { shiftMonth } from "../utils/calendar";

import { useAppStore } from "../stores";
import { useDailyLogQuery } from "../queries";
import { formatDateKey } from "../utils/holidays";

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
  const location = useLocation();
  const viewMonth = useAppStore((state) => state.viewMonth);
  const setSelectedDateKey = useAppStore((state) => state.setSelectedDateKey);
  const setViewMonth = useAppStore((state) => state.setViewMonth);
  const [isDateSheetExpanded, setIsDateSheetExpanded] = useState(false);
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const routeSearchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const isSheetRequestedFromUrl = routeSearchParams.get("sheet") === "1";
  const requestedDateKeyFromUrl = routeSearchParams.get("date");
  const restFinishedRequestedFromUrl = routeSearchParams.get("restFinished") === "1";
  const lastAppliedSearchRef = useRef<string | null>(null);

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

  useEffect(() => {
    if (isOverlayActive) {
      return;
    }

    // URL이 실제로 변경된 경우에만 URL -> UI 상태 동기화
    if (lastAppliedSearchRef.current === location.search) {
      return;
    }
    lastAppliedSearchRef.current = location.search;

    if (!isSheetRequestedFromUrl) {
      setIsDateSheetExpanded(false);
      return;
    }
    setIsDateSheetExpanded(true);

    if (!requestedDateKeyFromUrl) {
      return;
    }

    const matched = requestedDateKeyFromUrl.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!matched) {
      return;
    }

    setSelectedDateKey(requestedDateKeyFromUrl);

    const year = Number(matched[1]);
    const month = Number(matched[2]);
    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return;
    }
    setViewMonth(new Date(year, month - 1, 1));
  }, [
    location.search,
    isOverlayActive,
    isSheetRequestedFromUrl,
    requestedDateKeyFromUrl,
    setSelectedDateKey,
    setViewMonth,
  ]);

  useEffect(() => {
    if (typeof window === "undefined" || isOverlayActive) {
      return;
    }

    const resolvedDateKey = selectedDateKey ?? formatDateKey(new Date());
    const nextHashPath = isDateSheetExpanded
      ? `/calendar?sheet=1&date=${encodeURIComponent(resolvedDateKey)}${
          restFinishedRequestedFromUrl ? "&restFinished=1" : ""
        }`
      : "/calendar";
    const currentHashPath = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;

    if (currentHashPath === nextHashPath) {
      return;
    }

    const nextUrl = `${window.location.pathname}${window.location.search}#${nextHashPath}`;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, [isDateSheetExpanded, isOverlayActive, restFinishedRequestedFromUrl, selectedDateKey]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PageHeader route={MAIN_ROUTE} />
      <CalendarPage
        logsByDate={logsByDate}
        onRequestOpenDateTasksSheet={() => setIsDateSheetExpanded(true)}
      />
      <DateTasksBottomSheet
        isVisible={!isOverlayActive}
        isExpanded={isDateSheetExpanded}
        restFinishedRequested={restFinishedRequestedFromUrl}
        onExpandedChange={setIsDateSheetExpanded}
      />
    </div>
  );
}
