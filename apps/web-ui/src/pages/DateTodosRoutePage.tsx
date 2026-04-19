import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { DateTodosBoard } from "../features/todo/date-todos/components/DateTodosBoard";
import { DateTodosFooterPanel } from "../features/todo/date-todos/components/DateTodosFooterPanel";
import { DateTodosOverlays } from "../features/todo/date-todos/components/DateTodosOverlays";
import {
  DateTodosRoutineCreateRouteLayer,
  DateTodosRoutineImportRouteLayer,
} from "../features/todo/date-todos/components/DateTodosRoutineRouteLayers";
import { DateTodosRouteProvider } from "../features/todo/date-todos/DateTodosRouteProvider";
import { useAppNavigation } from "../providers/AppNavigationProvider";

type DateTodosRoutePageProps = {
  forcedPathname?: string;
  forcedSearch?: string;
};

export function DateTodosRoutePage({ forcedPathname, forcedSearch }: DateTodosRoutePageProps) {
  const location = useLocation();
  const { goBack, goPage } = useAppNavigation();
  const pathname = forcedPathname ?? location.pathname;
  const search = forcedSearch ?? location.search;
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const dateKey = searchParams.get("date");
  const restFinishedRequested = searchParams.get("restFinished") === "1";
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isRoutineImportRoute = normalizedPathname === "/date-tasks/routines";
  const isRoutineCreateRoute = normalizedPathname === "/date-tasks/routines/new";
  const isTaskPickerRoute = normalizedPathname === "/date-tasks/add";
  const isMemoRoute = normalizedPathname === "/date-tasks/memo";

  const closeSubRoute = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      goBack();
      return;
    }

    goPage("/date-tasks", {
      query: dateKey ? { date: dateKey } : undefined,
      replace: true,
    });
  };

  const openTaskPickerRoute = () => goPage("/date-tasks/add", { query: dateKey ? { date: dateKey } : undefined });
  const openMemoRoute = () => goPage("/date-tasks/memo", { query: dateKey ? { date: dateKey } : undefined });
  const openRoutineImportRoute = () =>
    goPage("/date-tasks/routines", { query: dateKey ? { date: dateKey } : undefined });
  const openRoutineCreateRoute = () =>
    goPage("/date-tasks/routines/new", { query: dateKey ? { date: dateKey } : undefined });

  return (
    <DateTodosRouteProvider
      dateKey={dateKey}
      restFinishedRequested={restFinishedRequested}
      onOpenMemo={openMemoRoute}
      onOpenTaskPicker={openTaskPickerRoute}
      onOpenRoutineImport={openRoutineImportRoute}
      onOpenRoutineCreate={openRoutineCreateRoute}
    >
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
        {isRoutineImportRoute ? (
          <DateTodosRoutineImportRouteLayer onClose={closeSubRoute} />
        ) : isRoutineCreateRoute ? (
          <DateTodosRoutineCreateRouteLayer onClose={closeSubRoute} />
        ) : (
          <>
            <DateTodosBoard />
            <DateTodosFooterPanel />
            <DateTodosOverlays
              isTaskPickerRoute={isTaskPickerRoute}
              isMemoRoute={isMemoRoute}
              closeTaskPickerRoute={closeSubRoute}
              closeMemoRoute={closeSubRoute}
            />
          </>
        )}
      </section>
    </DateTodosRouteProvider>
  );
}
