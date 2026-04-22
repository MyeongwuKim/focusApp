import { FiArrowRight, FiBarChart2, FiPlus } from "react-icons/fi";
import { PillActionButton } from "../../../components/ui/PillActionButton";
import { useAppNavigation } from "../../../providers/AppNavigationProvider";
import { actionSheet, toast } from "../../../stores";
import {
  useTaskManagementActions,
  useTaskManagementData,
} from "../providers/TaskManagementContextProvider";
import { useTaskManagementModals } from "../providers/TaskManagementModalProvider";

export function TaskManagementActions() {
  const { goPage } = useAppNavigation();
  const { onCreateCollection, onCreateTask, onMoveTaskToCollection } = useTaskManagementActions();
  const { tasks, collections, selectedCollectionId, selectedTaskId } = useTaskManagementData();
  const { openCreateCollection, openCreateTask } = useTaskManagementModals();
  const selectedTask = selectedTaskId ? tasks.find((task) => task.id === selectedTaskId) : null;

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

  const handleOpenTaskStats = () => {
    if (!selectedTask) {
      return;
    }
    goPage("/tasks/stats", {
      query: {
        taskId: selectedTask.id,
        taskLabel: selectedTask.label,
        preset: "7d",
      },
    });
  };

  const handleMoveSelectedTask = () => {
    if (!selectedTask) {
      return;
    }

    void (async () => {
      const targetCollections = collections.filter((collection) => collection.id !== selectedTask.collectionId);
      if (targetCollections.length === 0) {
        toast.error("이동할 수 있는 컬렉션이 없어요.", "이동 불가");
        return;
      }

      const collectionCountMap = new Map<string, number>();
      tasks.forEach((task) => {
        collectionCountMap.set(task.collectionId, (collectionCountMap.get(task.collectionId) ?? 0) + 1);
      });

      const nextCollectionId = await actionSheet({
        title: "컬렉션으로 이동",
        message: "선택한 할일을 이동할 컬렉션을 선택하세요",
        items: targetCollections.map((collection) => ({
          label: collection.name,
          value: collection.id,
          description: `할일 ${collectionCountMap.get(collection.id) ?? 0}개`,
        })),
      });

      if (!nextCollectionId) {
        return;
      }

      onMoveTaskToCollection(selectedTask.id, nextCollectionId);
    })();
  };

  return (
    <div className="flex w-full items-center justify-end gap-2 select-none">
      <PillActionButton icon={<FiBarChart2 size={14} />} onClick={handleOpenTaskStats} disabled={!selectedTask}>
        통계
      </PillActionButton>
      <PillActionButton icon={<FiArrowRight size={14} />} onClick={handleMoveSelectedTask} disabled={!selectedTask}>
        이동
      </PillActionButton>
      <PillActionButton icon={<FiPlus size={14} />} onClick={handleOpenCollection}>
        컬렉션
      </PillActionButton>
      <PillActionButton icon={<FiPlus size={14} />} onClick={handleOpenTaskPicker}>
        할일
      </PillActionButton>
    </div>
  );
}
