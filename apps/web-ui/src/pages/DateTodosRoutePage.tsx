import { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { DateTodosBoard } from "../features/todo/date-todos/components/DateTodosBoard";
import { DateTodosFooterPanel } from "../features/todo/date-todos/components/DateTodosFooterPanel";
import { DateTodosOverlays } from "../features/todo/date-todos/components/DateTodosOverlays";
import { DateTodosRouteProvider } from "../features/todo/date-todos/DateTodosRouteProvider";

export function DateTodosRoutePage() {
  const location = useLocation();
  const dateKey = useMemo(() => new URLSearchParams(location.search).get("date"), [location.search]);

  return (
    <DateTodosRouteProvider dateKey={dateKey}>
      <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
        <DateTodosBoard />
        <DateTodosFooterPanel />
        <DateTodosOverlays />
      </section>
    </DateTodosRouteProvider>
  );
}
