import { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { shiftDateKey } from "../features/calendar/utils/date";
import { DateTodosBoard } from "../features/todo/date-todos/components/DateTodosBoard";
import { DateTodosFooterPanel } from "../features/todo/date-todos/components/DateTodosFooterPanel";
import { DateTodosMemoStandaloneLayer } from "../features/todo/date-todos/components/DateTodosMemoStandaloneLayer";
import { DateTodosOverlays } from "../features/todo/date-todos/components/DateTodosOverlays";
import { DateTodosRoutineStandaloneLayer } from "../features/todo/date-todos/components/DateTodosRoutineStandaloneLayer";
import { DateTodosTaskPickerStandaloneLayer } from "../features/todo/date-todos/components/DateTodosTaskPickerStandaloneLayer";
import { DateTodosRouteProvider } from "../features/todo/date-todos/DateTodosRouteProvider";
import { useAppNavigation } from "../providers/AppNavigationProvider";
import { formatDateKey } from "../utils/holidays";

type DateTodosRoutePageProps = {
  forcedPathname?: string;
  forcedSearch?: string;
  isActive?: boolean;
  onShiftDateKey?: (nextDateKey: string) => void;
  onOpenTaskPickerPage?: () => void;
  onOpenMemoPage?: () => void;
  onOpenRoutineImportPage?: () => void;
  onOpenRoutineCreatePage?: () => void;
};

export function DateTodosRoutePage({
  forcedPathname,
  forcedSearch,
  isActive = true,
  onShiftDateKey,
  onOpenTaskPickerPage,
  onOpenMemoPage,
  onOpenRoutineImportPage,
  onOpenRoutineCreatePage,
}: DateTodosRoutePageProps) {
  const location = useLocation();
  const { goBack, goPage } = useAppNavigation();
  const pathname = forcedPathname ?? location.pathname;
  const search = forcedSearch ?? location.search;
  const searchParams = useMemo(() => new URLSearchParams(search), [search]);
  const dateKey = searchParams.get("date");
  const resolvedDateKey = dateKey ?? formatDateKey(new Date());
  const restFinishedRequested = searchParams.get("restFinished") === "1";
  const normalizedPathname = pathname.replace(/\/+$/, "") || "/";
  const isRoutineImportRoute = normalizedPathname === "/date-tasks/routines";
  const isRoutineCreateRoute = normalizedPathname === "/date-tasks/routines/new";
  const isTaskPickerRoute = normalizedPathname === "/date-tasks/add";
  const isMemoRoute = normalizedPathname === "/date-tasks/memo";

  useEffect(() => {
    if (!isActive || dateKey) {
      return;
    }

    goPage(pathname, {
      query: {
        date: resolvedDateKey,
        ...(restFinishedRequested ? { restFinished: "1" } : {}),
      },
      replace: true,
    });
  }, [dateKey, goPage, isActive, pathname, resolvedDateKey, restFinishedRequested]);

  const closeSubRoute = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      goBack();
      return;
    }

    goPage("/date-tasks", {
      query: { date: resolvedDateKey },
      replace: true,
    });
  };

  const openTaskPickerRoute = () => {
    if (onOpenTaskPickerPage) {
      onOpenTaskPickerPage();
      return;
    }
    goPage("/date-tasks/add", { query: { date: resolvedDateKey } });
  };
  const openMemoRoute = () => {
    if (onOpenMemoPage) {
      onOpenMemoPage();
      return;
    }
    goPage("/date-tasks/memo", { query: { date: resolvedDateKey } });
  };
  const openRoutineImportRoute = () => {
    if (onOpenRoutineImportPage) {
      onOpenRoutineImportPage();
      return;
    }
    goPage("/date-tasks/routines", { query: { date: resolvedDateKey } });
  };
  const openRoutineCreateRoute = () => {
    if (onOpenRoutineCreatePage) {
      onOpenRoutineCreatePage();
      return;
    }
    goPage("/date-tasks/routines/new", { query: { date: resolvedDateKey } });
  };
  const handleShiftDate = (days: number) => {
    const nextDateKey = shiftDateKey(resolvedDateKey, days);
    if (onShiftDateKey) {
      onShiftDateKey(nextDateKey);
      return;
    }
    goPage("/date-tasks", {
      query: {
        date: nextDateKey,
      },
      replace: true,
    });
  };

  if (isRoutineImportRoute || isRoutineCreateRoute) {
    return (
      <DateTodosRoutineStandaloneLayer
        dateKey={resolvedDateKey}
        mode={isRoutineImportRoute ? "import" : "create"}
        onClose={closeSubRoute}
      />
    );
  }

  if (isTaskPickerRoute) {
    return (
      <DateTodosTaskPickerStandaloneLayer
        dateKey={resolvedDateKey}
        onClose={closeSubRoute}
      />
    );
  }

  if (isMemoRoute) {
    return (
      <DateTodosMemoStandaloneLayer
        dateKey={resolvedDateKey}
        onClose={closeSubRoute}
      />
    );
  }

  return (
    <DateTodosRouteProvider
      dateKey={resolvedDateKey}
      restFinishedRequested={restFinishedRequested}
      onOpenMemo={openMemoRoute}
      onOpenTaskPicker={openTaskPickerRoute}
      onOpenRoutineImport={openRoutineImportRoute}
      onOpenRoutineCreate={openRoutineCreateRoute}
    >
      <section
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4"
        data-disable-overlay-swipe-back="true"
      >
        <DateTodosBoard dateKey={resolvedDateKey} onShiftDate={handleShiftDate} />
        <DateTodosFooterPanel />
        <DateTodosOverlays
          isTaskPickerRoute={isTaskPickerRoute}
          isMemoRoute={isMemoRoute}
          closeTaskPickerRoute={closeSubRoute}
          closeMemoRoute={closeSubRoute}
        />
      </section>
    </DateTodosRouteProvider>
  );
}
