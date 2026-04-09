import { FiX } from "react-icons/fi";
import { Button } from "../../../../components/ui/Button";
import { TodoCompletedAtModal } from "../../components/TodoCompletedAtModal";
import { TodoCompletionPanel } from "../../components/TodoCompletionPanel";
import { TodoRoutineCreateModal } from "../../components/TodoRoutineCreateModal";
import { TodoRoutineImportModal } from "../../components/TodoRoutineImportModal";
import { TodoScheduleTimeModal } from "../../components/TodoScheduleTimeModal";
import { TodoTaskPickerModal } from "../../components/TodoTaskPickerModal";
import { MemoEditorPanel } from "../../../memo/containers/MemoEditorPanel";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

export function DateTodosOverlays() {
  const {
    isTaskPickerOpen,
    closeTaskPicker,
    handleDateAddTasks,
    isRoutineImportOpen,
    closeRoutineImport,
    isRoutineCreateOpen,
    closeRoutineCreate,
    routineTemplates,
    isRoutineTemplatesLoading,
    handleApplyRoutineTemplate,
    handleCreateRoutineTemplate,
    handleUpdateRoutineTemplate,
    handleDeleteRoutineTemplate,
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
    editingScheduledStart,
    closeEditingScheduledStart,
    handleSaveScheduledStart,
  } = useDateTodosRouteContext();

  return (
    <>
      <TodoTaskPickerModal
        isOpen={isTaskPickerOpen}
        onClose={closeTaskPicker}
        onApply={handleDateAddTasks}
      />
      <TodoRoutineImportModal
        isOpen={isRoutineImportOpen}
        routines={routineTemplates}
        isLoading={isRoutineTemplatesLoading}
        onClose={closeRoutineImport}
        onApply={handleApplyRoutineTemplate}
        onUpdateRoutine={handleUpdateRoutineTemplate}
        onDeleteRoutine={handleDeleteRoutineTemplate}
      />
      <TodoRoutineCreateModal
        isOpen={isRoutineCreateOpen}
        onClose={closeRoutineCreate}
        onCreate={handleCreateRoutineTemplate}
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
              <Button variant="ghost" size="sm" circle aria-label="메모 닫기" onClick={closeMemo}>
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
