import { FiPlus } from "react-icons/fi";
import {
  useTaskManagementActions,
  useTaskManagementData,
} from "../providers/TaskManagementContextProvider";
import { useTaskManagementModals } from "../providers/TaskManagementModalProvider";

export function TaskManagementActions() {
  const { onCreateCollection, onCreateTask } = useTaskManagementActions();
  const { tasks, collections, selectedCollectionId, selectedTaskId } = useTaskManagementData();
  const { openCreateCollection, openCreateTask } = useTaskManagementModals();

  const handleOpenCollection = () => {
    void (async () => {
      const name = await openCreateCollection();
      if (!name) {
        return;
      }
      await onCreateCollection(name);
    })();
  };

  const handleOpenTaskPicker = () => {
    void (async () => {
      const selectedTaskCollectionId = selectedTaskId
        ? tasks.find((task) => task.id === selectedTaskId)?.collectionId
        : undefined;
      const defaultCollectionId =
        selectedCollectionId !== "all" ? selectedCollectionId : selectedTaskCollectionId;
      const taskInput = await openCreateTask(collections, defaultCollectionId);
      if (!taskInput) {
        return;
      }
      await onCreateTask(taskInput);
    })();
  };

  return (
    <div className="flex w-full items-center justify-end gap-2 select-none">
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border-base-300/75 bg-base-200/55 px-4 text-sm text-base-content/85 shadow-none"
        onClick={handleOpenCollection}
      >
        <FiPlus size={14} />
        컬렉션
      </button>
      <button
        type="button"
        className="btn h-10 min-h-10 rounded-full border-base-300/75 bg-base-200/55 px-4 text-sm text-base-content/85 shadow-none"
        onClick={handleOpenTaskPicker}
      >
        <FiPlus size={14} />
        할일
      </button>
    </div>
  );
}
