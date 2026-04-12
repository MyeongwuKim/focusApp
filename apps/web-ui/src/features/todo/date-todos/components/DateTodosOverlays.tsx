import { useEffect, useState } from "react";
import { FiX } from "react-icons/fi";
import { Button } from "../../../../components/ui/Button";
import { TodoCompletedAtModal } from "../../components/TodoCompletedAtModal";
import { TodoCompletionPanel } from "../../components/TodoCompletionPanel";
import { TodoScheduleTimeModal } from "../../components/TodoScheduleTimeModal";
import { TodoTaskPickerModal } from "../../components/TodoTaskPickerModal";
import { MemoEditorPanel } from "../../../memo/containers/MemoEditorPanel";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

type DateTodosOverlaysProps = {
  isTaskPickerRoute: boolean;
  isMemoRoute: boolean;
  closeTaskPickerRoute: () => void;
  closeMemoRoute: () => void;
};

export function DateTodosOverlays({
  isTaskPickerRoute,
  isMemoRoute,
  closeTaskPickerRoute,
  closeMemoRoute,
}: DateTodosOverlaysProps) {
  const {
    handleDateAddTasks,
    resolvedMemoDateKey,
    shouldRenderCompletionPanel,
    isCompletionPanelVisible,
    closeCompletionPanel,
    editingActualFocus,
    closeEditingActualFocus,
    handleSaveActualFocus,
    editingScheduledStart,
    closeEditingScheduledStart,
    handleSaveScheduledStart,
  } = useDateTodosRouteContext();
  const [shouldRenderMemo, setShouldRenderMemo] = useState(isMemoRoute);
  const [isMemoVisible, setIsMemoVisible] = useState(false);

  useEffect(() => {
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    if (isMemoRoute) {
      setShouldRenderMemo(true);
      rafId = window.requestAnimationFrame(() => {
        setIsMemoVisible(true);
      });
    } else {
      setIsMemoVisible(false);
      timeoutId = window.setTimeout(() => {
        setShouldRenderMemo(false);
      }, 240);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isMemoRoute]);

  return (
    <>
      <TodoTaskPickerModal
        isOpen={isTaskPickerRoute}
        onClose={closeTaskPickerRoute}
        onApply={handleDateAddTasks}
      />

      {shouldRenderMemo ? (
        <div
          className={[
            "absolute inset-0 z-40 transition-opacity duration-250 ease-out",
            isMemoVisible ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          <div
            className={[
              "absolute inset-0 flex flex-col bg-base-100 transition-[transform,opacity] duration-250 ease-out",
              isMemoVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90",
            ].join(" ")}
          >
            <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-base-300/80 px-2">
              <Button variant="ghost" size="sm" circle aria-label="메모 닫기" onClick={closeMemoRoute}>
                <FiX size={18} />
              </Button>
              <h2 className="m-0 text-center text-sm font-semibold text-base-content">
                {resolvedMemoDateKey} 메모
              </h2>
              <div aria-hidden="true" />
            </header>
            <div className="min-h-0 flex-1 p-2">
              <MemoEditorPanel
                dateKey={resolvedMemoDateKey}
                className="h-full rounded-xl border-base-300/70 bg-base-200/35 p-2.5"
              />
            </div>
          </div>
        </div>
      ) : null}

      {shouldRenderCompletionPanel ? (
        <TodoCompletionPanel isVisible={isCompletionPanelVisible} onClose={closeCompletionPanel} />
      ) : null}

      <TodoCompletedAtModal
        isOpen={Boolean(editingActualFocus)}
        initialMinutes={editingActualFocus?.initialMinutes ?? 0}
        onClose={closeEditingActualFocus}
        onSave={handleSaveActualFocus}
      />

      <TodoScheduleTimeModal
        isOpen={Boolean(editingScheduledStart)}
        dateKey={resolvedMemoDateKey}
        initialTime={editingScheduledStart?.initialTime ?? "09:00"}
        onClose={closeEditingScheduledStart}
        onSave={handleSaveScheduledStart}
      />
    </>
  );
}
