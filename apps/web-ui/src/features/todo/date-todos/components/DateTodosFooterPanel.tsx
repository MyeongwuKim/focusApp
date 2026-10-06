import { useMemo } from "react";
import { TodoProgressFooter } from "../../components/TodoProgressFooter";
import { TodoQuickActions } from "../../components/TodoQuickActions";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";
import { summarizeDateTodoItems } from "../utils/dateTodosSummary";

type DateTodosFooterPanelProps = {
  pendingDeletedTaskId?: string | null;
};

export function DateTodosFooterPanel({ pendingDeletedTaskId = null }: DateTodosFooterPanelProps) {
  const {
    items,
    openMemo,
    openTaskPicker,
    openRoutineImport,
    summary,
    session,
    toggleRestSession,
  } = useDateTodosRouteContext();
  const displayedSummary = useMemo(
    () => pendingDeletedTaskId ? summarizeDateTodoItems(items, pendingDeletedTaskId) : summary,
    [items, pendingDeletedTaskId, summary]
  );

  return (
    <div
      className="date-todos-footer mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5 pb-[var(--app-safe-area-bottom)]"
      data-disable-date-sheet-swipe="true"
    >
      <TodoQuickActions
        onOpenMemo={openMemo}
        onOpenTaskPicker={openTaskPicker}
        onOpenRoutineImport={openRoutineImport}
      />
      <TodoProgressFooter
        summary={displayedSummary}
        session={session}
        onToggleRest={toggleRestSession}
      />
    </div>
  );
}
