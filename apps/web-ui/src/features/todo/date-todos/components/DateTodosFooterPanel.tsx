import { TodoProgressFooter } from "../../components/TodoProgressFooter";
import { TodoQuickActions } from "../../components/TodoQuickActions";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

export function DateTodosFooterPanel() {
  const {
    openMemo,
    openTaskPicker,
    openRestSettings,
    summary,
    session,
    toggleRestSession,
    handleApplyRestDurationOnce,
    handleSaveRestDurationDefault,
    openRestSettingsRequestId,
  } = useDateTodosRouteContext();

  return (
    <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
      <TodoQuickActions
        onOpenMemo={openMemo}
        onOpenTaskPicker={openTaskPicker}
        onOpenRestSettings={openRestSettings}
      />
      <TodoProgressFooter
        summary={summary}
        session={session}
        onToggleRest={toggleRestSession}
        onApplyRestDurationOnce={handleApplyRestDurationOnce}
        onSaveRestDurationDefault={handleSaveRestDurationDefault}
        openRestSettingsRequestId={openRestSettingsRequestId}
      />
    </div>
  );
}
