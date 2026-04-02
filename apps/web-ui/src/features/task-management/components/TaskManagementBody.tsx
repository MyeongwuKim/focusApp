import { useEffect, useMemo } from "react";
import { FiEdit3, FiTrash2 } from "react-icons/fi";
import { actionSheet } from "../../../stores";
import { useTaskManagementView } from "../providers/TaskManagementViewProvider";
import { TaskManagementCollectionItem } from "./TaskManagementCollectionItem";
import { TaskManagementTaskItem } from "./TaskManagementTaskItem";

export type ManagedTaskItem = {
  id: string;
  label: string;
  collectionId: string;
};

export type ManagedCollection = {
  id: string;
  name: string;
};

export function TaskManagementBody() {
  const {
    tasks,
    collections,
    selectedCollectionId,
    onSelectCollection,
    selectedTaskId,
    onSelectTask,
    onRequestRenameTask,
    onRequestDeleteTask,
    onRequestRenameCollection,
    onRequestDeleteCollection,
  } = useTaskManagementView();

  const collectionCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((task) => {
      counts.set(task.collectionId, (counts.get(task.collectionId) ?? 0) + 1);
    });
    return counts;
  }, [tasks]);

  const visibleTasks = useMemo(() => {
    if (selectedCollectionId === "all") {
      return tasks;
    }
    return tasks.filter((task) => task.collectionId === selectedCollectionId);
  }, [selectedCollectionId, tasks]);

  const collectionNameById = useMemo(() => {
    return new Map(collections.map((collection) => [collection.id, collection.name]));
  }, [collections]);

  const handleTaskMenu = async (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) {
      return;
    }

    const selected = await actionSheet({
      title: target.label,
      message: "작업을 선택하세요",
      items: [
        {
          label: "이름 변경",
          value: "rename",
          tone: "primary",
          icon: <FiEdit3 size={14} />,
          description: "할일 이름을 변경합니다.",
        },
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description: "이 할일을 삭제합니다.",
        },
      ],
    });

    if (selected === "rename") {
      onRequestRenameTask(taskId);
    }
    if (selected === "delete") {
      onRequestDeleteTask(taskId);
    }
  };

  const handleCollectionMenu = async (collectionId: string) => {
    const target = collections.find((collection) => collection.id === collectionId);
    if (!target) {
      return;
    }

    const selected = await actionSheet({
      title: target.name,
      message: "작업을 선택하세요",
      items: [
        {
          label: "이름 변경",
          value: "rename",
          tone: "primary",
          icon: <FiEdit3 size={14} />,
          description: "컬렉션 이름을 변경합니다.",
        },
        {
          label: "삭제",
          value: "delete",
          tone: "danger",
          icon: <FiTrash2 size={14} />,
          description:
            collectionId === "collection-default"
              ? "기본 컬렉션은 삭제할 수 없습니다."
              : "컬렉션을 삭제하고 할일은 기본 컬렉션으로 이동합니다.",
          disabled: collectionId === "collection-default",
        },
      ],
    });

    if (selected === "rename") {
      onRequestRenameCollection(collectionId);
    }
    if (selected === "delete") {
      onRequestDeleteCollection(collectionId);
    }
  };

  useEffect(() => {
    if (selectedCollectionId === "all") {
      return;
    }
    if (!collections.some((collection) => collection.id === selectedCollectionId)) {
      onSelectCollection("all");
    }
  }, [collections, onSelectCollection, selectedCollectionId]);

  return (
    <div className="min-h-0 flex-1 select-none">
      <div className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_136px] gap-2">
        <div className="min-h-0 min-w-0 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
          <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {visibleTasks.length > 0 ? (
              visibleTasks.map((task) => (
                <TaskManagementTaskItem
                  key={task.id}
                  label={task.label}
                  collectionName={collectionNameById.get(task.collectionId) ?? "미분류"}
                  active={selectedTaskId === task.id}
                  onSelect={() => onSelectTask(task.id)}
                  onOpenMenu={() => {
                    void handleTaskMenu(task.id);
                  }}
                />
              ))
            ) : (
              <p className="m-0 px-1 py-2 text-sm text-base-content/70">선택한 컬렉션의 할일이 없어요.</p>
            )}
          </div>
        </div>

        <aside className="min-w-0 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
          <div className="space-y-1.5">
            <TaskManagementCollectionItem
              name="전체"
              count={tasks.length}
              active={selectedCollectionId === "all"}
              onSelect={() => onSelectCollection("all")}
            />
            {collections.map((collection) => {
              const active = selectedCollectionId === collection.id;
              return (
                <TaskManagementCollectionItem
                  key={collection.id}
                  name={collection.name}
                  count={collectionCountMap.get(collection.id) ?? 0}
                  active={active}
                  onSelect={() => onSelectCollection(collection.id)}
                  onOpenMenu={() => {
                    void handleCollectionMenu(collection.id);
                  }}
                />
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
