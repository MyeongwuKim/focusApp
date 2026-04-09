import { FiPlus } from "react-icons/fi";
import { PillActionButton } from "../../../components/ui/PillActionButton";
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
      <PillActionButton icon={<FiPlus size={14} />} onClick={handleOpenCollection}>
        컬렉션
      </PillActionButton>
      <PillActionButton icon={<FiPlus size={14} />} onClick={handleOpenTaskPicker}>
        할일
      </PillActionButton>
    </div>
  );
}
