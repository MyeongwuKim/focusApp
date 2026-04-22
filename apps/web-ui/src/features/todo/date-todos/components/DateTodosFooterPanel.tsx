import { useState } from "react";
import { TodoProgressFooter } from "../../components/TodoProgressFooter";
import { TodoQuickActions } from "../../components/TodoQuickActions";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

export function DateTodosFooterPanel() {
  const [openRestSettingsRequestId, setOpenRestSettingsRequestId] = useState(0);
  const {
    openMemo,
    openTaskPicker,
    summary,
    session,
    toggleRestSession,
  } = useDateTodosRouteContext();

  return (
    <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5" data-disable-date-sheet-swipe="true">
      <TodoQuickActions
        onOpenMemo={openMemo}
        onOpenTaskPicker={openTaskPicker}
        onOpenRestSettings={() => setOpenRestSettingsRequestId((prev) => prev + 1)}
      />
      <TodoProgressFooter
        summary={summary}
        session={session}
        onToggleRest={toggleRestSession}
        openRestSettingsRequestId={openRestSettingsRequestId}
      />
    </div>
  );
}
