import { FiX } from "react-icons/fi";
import { TodoCompletedAtModal } from "../../components/TodoCompletedAtModal";
import { TodoCompletionPanel } from "../../components/TodoCompletionPanel";
import { TodoTaskPickerModal } from "../../components/TodoTaskPickerModal";
import { MemoPage } from "../../../../pages/MemoPage";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

export function DateTodosOverlays() {
  const {
    isTaskPickerOpen,
    closeTaskPicker,
    handleDateAddTasks,
    shouldRenderMemo,
    isMemoVisible,
    closeMemo,
    resolvedMemoDateKey,
    shouldRenderCompletionPanel,
    isCompletionPanelVisible,
    closeCompletionPanel,
    editingActualFocus,
    closeEditingActualFocus,
    handleSaveActualFocus,
  } = useDateTodosRouteContext();

  return (
    <>
      <TodoTaskPickerModal
        isOpen={isTaskPickerOpen}
        onClose={closeTaskPicker}
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
              <button
                type="button"
                aria-label="메모 닫기"
                className="btn btn-sm btn-ghost btn-circle"
                onClick={closeMemo}
              >
                <FiX size={18} />
              </button>
              <h2 className="m-0 text-center text-sm font-semibold text-base-content">
                {resolvedMemoDateKey} 메모
              </h2>
              <div aria-hidden="true" />
            </header>
            <div className="min-h-0 flex-1 p-2">
              <MemoPage
                dateKey={resolvedMemoDateKey}
                className="h-full rounded-xl border-base-300/70 bg-base-200/35 p-2.5"
              />
            </div>
          </div>
        </div>
      ) : null}

      {shouldRenderCompletionPanel ? (
        <TodoCompletionPanel
          isVisible={isCompletionPanelVisible}
          onClose={closeCompletionPanel}
        />
      ) : null}

      <TodoCompletedAtModal
        isOpen={Boolean(editingActualFocus)}
        initialMinutes={editingActualFocus?.initialMinutes ?? 0}
        onClose={closeEditingActualFocus}
        onSave={handleSaveActualFocus}
      />
    </>
  );
}
