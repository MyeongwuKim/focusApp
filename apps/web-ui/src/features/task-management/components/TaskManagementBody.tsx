import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiEdit3, FiTrash2 } from "react-icons/fi";
import { actionSheet } from "../../../stores";
import {
  useTaskManagementActions,
  useTaskManagementData,
} from "../providers/TaskManagementContextProvider";
import { useTaskManagementModals } from "../providers/TaskManagementModalProvider";
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

const TASK_DRAG_ID_PREFIX = "task:";
const COLLECTION_DROP_ID_PREFIX = "collection:";

const toTaskDragId = (taskId: string) => `${TASK_DRAG_ID_PREFIX}${taskId}`;
const toCollectionDropId = (collectionId: string) => `${COLLECTION_DROP_ID_PREFIX}${collectionId}`;

const parseTaskDragId = (dragId: string) =>
  dragId.startsWith(TASK_DRAG_ID_PREFIX) ? dragId.slice(TASK_DRAG_ID_PREFIX.length) : null;

const parseCollectionDropId = (dropId: string) =>
  dropId.startsWith(COLLECTION_DROP_ID_PREFIX) ? dropId.slice(COLLECTION_DROP_ID_PREFIX.length) : null;

function DraggableTaskItem({
  task,
  collectionName,
  active,
  disableActions,
  disableDrag,
  onSelect,
  onOpenMenu,
}: {
  task: ManagedTaskItem;
  collectionName: string;
  active: boolean;
  disableActions: boolean;
  disableDrag: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toTaskDragId(task.id),
    disabled: disableDrag,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskManagementTaskItem
        label={task.label}
        collectionName={collectionName}
        active={active}
        isDragging={isDragging}
        disableActions={disableActions}
        onSelect={onSelect}
        sideButton={{
          type: "menu",
          ariaLabel: "할일 옵션",
          onClick: onOpenMenu,
        }}
      />
    </div>
  );
}

function DroppableCollectionItem({
  collectionId,
  name,
  count,
  active,
  draggingTaskId,
  onSelect,
  onOpenMenu,
}: {
  collectionId: string;
  name: string;
  count: number;
  active: boolean;
  draggingTaskId: string | null;
  onSelect: () => void;
  onOpenMenu?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: toCollectionDropId(collectionId),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    position: isDragging ? ("relative" as const) : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes}>
      <TaskManagementCollectionItem
        name={name}
        count={count}
        active={active}
        dropActive={Boolean(draggingTaskId) && isOver}
        onSelect={onSelect}
        onOpenMenu={onOpenMenu}
      />
    </div>
  );
}

export function TaskManagementBody() {
  const { tasks, collections, selectedCollectionId, selectedTaskId } = useTaskManagementData();
  const {
    onSelectCollection,
    onSelectTask,
    onRenameTask,
    onDeleteTask,
    onRenameCollection,
    onDeleteCollection,
    onMoveTaskToCollection,
    onReorderVisibleTasks,
    onReorderCollections,
  } = useTaskManagementActions();
  const { openRename } = useTaskManagementModals();
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const draggingTask = useMemo(
    () => (draggingTaskId ? tasks.find((task) => task.id === draggingTaskId) ?? null : null),
    [draggingTaskId, tasks]
  );

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
  const isAllCollectionSelected = selectedCollectionId === "all";

  const collectionNameById = useMemo(() => {
    return new Map(collections.map((collection) => [collection.id, collection.name]));
  }, [collections]);

  const visibleTaskDragIds = useMemo(
    () => visibleTasks.map((task) => toTaskDragId(task.id)),
    [visibleTasks]
  );
  const collectionDropIds = useMemo(
    () => collections.map((collection) => toCollectionDropId(collection.id)),
    [collections]
  );

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTaskId(null);
    if (!event.over) {
      return;
    }

    const activeId = String(event.active.id);
    const overId = String(event.over.id);

    const activeTaskId = parseTaskDragId(activeId);
    const overTaskId = parseTaskDragId(overId);
    if (activeTaskId && overTaskId) {
      if (isAllCollectionSelected) {
        return;
      }
      onReorderVisibleTasks(activeTaskId, overTaskId);
      return;
    }

    if (activeTaskId) {
      const targetCollectionId = parseCollectionDropId(overId);
      if (!targetCollectionId) {
        return;
      }
      onMoveTaskToCollection(activeTaskId, targetCollectionId);
      return;
    }

    const activeCollectionId = parseCollectionDropId(activeId);
    const overCollectionId = parseCollectionDropId(overId);
    if (!activeCollectionId || !overCollectionId) {
      return;
    }
    onReorderCollections(activeCollectionId, overCollectionId);
  };

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
      const nextName = await openRename({
        title: "할일 이름 변경",
        initialValue: target.label,
        placeholder: "할일 이름",
      });
      if (!nextName) {
        return;
      }
      onRenameTask(taskId, nextName);
    }
    if (selected === "delete") {
      void onDeleteTask(taskId);
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
      const nextName = await openRename({
        title: "컬렉션 이름 변경",
        initialValue: target.name,
        placeholder: "컬렉션 이름",
      });
      if (!nextName) {
        return;
      }
      onRenameCollection(collectionId, nextName);
    }
    if (selected === "delete") {
      void onDeleteCollection(collectionId);
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={(event) => {
            setDraggingTaskId(parseTaskDragId(String(event.active.id)));
          }}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setDraggingTaskId(null);
          }}
        >
          <div className="min-h-0 min-w-0 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
            <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
              {isAllCollectionSelected ? (
                <p className="m-0 px-1 py-1 text-[11px] text-base-content/55">
                  전체 보기에서는 할일 순서 변경이 비활성화됩니다.
                </p>
              ) : null}
              {visibleTasks.length > 0 ? (
                <SortableContext items={visibleTaskDragIds} strategy={verticalListSortingStrategy}>
                  {visibleTasks.map((task) => (
                    <DraggableTaskItem
                      key={task.id}
                      task={task}
                      collectionName={collectionNameById.get(task.collectionId) ?? "미분류"}
                      active={selectedTaskId === task.id}
                      disableActions={Boolean(draggingTaskId)}
                      disableDrag={isAllCollectionSelected}
                      onSelect={() => onSelectTask(task.id)}
                      onOpenMenu={() => {
                        void handleTaskMenu(task.id);
                      }}
                    />
                  ))}
                </SortableContext>
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
              <SortableContext items={collectionDropIds} strategy={verticalListSortingStrategy}>
                {collections.map((collection) => {
                  const active = selectedCollectionId === collection.id;
                  return (
                    <DroppableCollectionItem
                      key={collection.id}
                      collectionId={collection.id}
                      name={collection.name}
                      count={collectionCountMap.get(collection.id) ?? 0}
                      active={active}
                      draggingTaskId={draggingTaskId}
                      onSelect={() => onSelectCollection(collection.id)}
                      onOpenMenu={() => {
                        void handleCollectionMenu(collection.id);
                      }}
                    />
                  );
                })}
              </SortableContext>
            </div>
          </aside>
          <DragOverlay>
            {draggingTask ? (
              <div className="w-[min(360px,62vw)] rounded-lg">
                <TaskManagementTaskItem
                  label={draggingTask.label}
                  collectionName={collectionNameById.get(draggingTask.collectionId) ?? "미분류"}
                  active={selectedTaskId === draggingTask.id}
                  disableActions
                  onOpenMenu={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      </div>
    </div>
  );
}
