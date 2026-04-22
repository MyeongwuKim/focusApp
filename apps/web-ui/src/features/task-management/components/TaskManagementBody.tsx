import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  defaultAnimateLayoutChanges,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { FiArrowRight, FiEdit3, FiTrash2 } from "react-icons/fi";
import { actionSheet, confirm, toast } from "../../../stores";
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
const UNCATEGORIZED_COLLECTION_NAME = "미분류";

const toTaskDragId = (taskId: string) => `${TASK_DRAG_ID_PREFIX}${taskId}`;
const toCollectionDropId = (collectionId: string) => `${COLLECTION_DROP_ID_PREFIX}${collectionId}`;

const parseTaskDragId = (dragId: string) =>
  dragId.startsWith(TASK_DRAG_ID_PREFIX) ? dragId.slice(TASK_DRAG_ID_PREFIX.length) : null;

const parseCollectionDropId = (dropId: string) =>
  dropId.startsWith(COLLECTION_DROP_ID_PREFIX) ? dropId.slice(COLLECTION_DROP_ID_PREFIX.length) : null;

const isUncategorizedCollection = (name: string) =>
  name.trim().toLowerCase() === UNCATEGORIZED_COLLECTION_NAME.toLowerCase();

const TASK_DRAG_START_DISTANCE_THRESHOLD = 6;

const isTaskDragContainerId = (containerId: string) => containerId.startsWith(TASK_DRAG_ID_PREFIX);
const isCollectionContainerId = (containerId: string) => containerId.startsWith(COLLECTION_DROP_ID_PREFIX);

const animateLayoutChanges = (
  args: Parameters<typeof defaultAnimateLayoutChanges>[0]
) => {
  if (args.isSorting || args.wasDragging) {
    return defaultAnimateLayoutChanges(args);
  }
  return false;
};

function DraggableTaskItem({
  task,
  collectionName,
  active,
  disableActions,
  onSelect,
  onOpenMenu,
}: {
  task: ManagedTaskItem;
  collectionName: string;
  active: boolean;
  disableActions: boolean;
  onSelect: () => void;
  onOpenMenu: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: toTaskDragId(task.id),
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
    opacity: isDragging ? 0 : 1,
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
  draggingCollectionId,
  onSelect,
  onOpenMenu,
}: {
  collectionId: string;
  name: string;
  count: number;
  active: boolean;
  draggingTaskId: string | null;
  draggingCollectionId: string | null;
  onSelect: () => void;
  onOpenMenu?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: toCollectionDropId(collectionId),
    animateLayoutChanges,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: isDragging ? undefined : transition,
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
        disableInteraction={Boolean(draggingCollectionId)}
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
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragStartPointer, setDragStartPointer] = useState<{ x: number; y: number } | null>(null);
  const [draggingTaskWidth, setDraggingTaskWidth] = useState<number | null>(null);
  const collectionPaneRef = useRef<HTMLElement | null>(null);
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
      activationConstraint: { distance: 2 },
    }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 3 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const collisionDetection = (args: Parameters<typeof closestCenter>[0]) => {
    const activeId = String(args.active.id);
    const activeTaskId = parseTaskDragId(activeId);
    if (activeTaskId) {
      const containersExcludingActive = args.droppableContainers.filter(
        (container) => String(container.id) !== activeId
      );
      const scopedArgs = {
        ...args,
        droppableContainers: containersExcludingActive,
      };

      const pointerCollisions = pointerWithin(scopedArgs);
      if (pointerCollisions.length > 0) {
        return pointerCollisions;
      }

      if (dragStartPointer && args.pointerCoordinates) {
        const distanceFromStart = Math.hypot(
          args.pointerCoordinates.x - dragStartPointer.x,
          args.pointerCoordinates.y - dragStartPointer.y
        );
        if (distanceFromStart < TASK_DRAG_START_DISTANCE_THRESHOLD) {
          return [];
        }
      }

      const collectionPaneBounds = collectionPaneRef.current?.getBoundingClientRect();
      const pointerX = args.pointerCoordinates?.x ?? null;
      const isPointerNearCollectionPane =
        collectionPaneBounds !== undefined &&
        collectionPaneBounds !== null &&
        pointerX !== null &&
        pointerX >= collectionPaneBounds.left - 6;

      if (isPointerNearCollectionPane) {
        const collectionContainers = containersExcludingActive.filter((container) =>
          isCollectionContainerId(String(container.id))
        );
        if (collectionContainers.length > 0) {
          return closestCenter({
            ...args,
            droppableContainers: collectionContainers,
          });
        }
      }

      const taskContainers = containersExcludingActive.filter((container) =>
        isTaskDragContainerId(String(container.id))
      );
      if (taskContainers.length > 0) {
        return closestCenter({
          ...args,
          droppableContainers: taskContainers,
        });
      }

      return [];
    }

    const activeCollectionId = parseCollectionDropId(activeId);
    if (!activeCollectionId) {
      return closestCenter(args);
    }

    const collectionOnlyContainers = args.droppableContainers.filter((container) =>
      String(container.id).startsWith(COLLECTION_DROP_ID_PREFIX)
    );

    const collectionScopedArgs = {
      ...args,
      droppableContainers: collectionOnlyContainers,
    };

    const pointerCollisions = pointerWithin(collectionScopedArgs);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    return closestCenter(collectionScopedArgs);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setDraggingTaskId(null);
    setDraggingCollectionId(null);
    setDragStartPointer(null);
    setDraggingTaskWidth(null);
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

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    setDraggingTaskId(parseTaskDragId(activeId));
    setDraggingCollectionId(parseCollectionDropId(activeId));
    const activeRectWidth = event.active.rect.current.initial?.width;
    setDraggingTaskWidth(typeof activeRectWidth === "number" ? activeRectWidth : null);

    const activatorEvent = event.activatorEvent as {
      clientX?: unknown;
      clientY?: unknown;
      touches?: ArrayLike<{ clientX: number; clientY: number }>;
      changedTouches?: ArrayLike<{ clientX: number; clientY: number }>;
    };
    if (activatorEvent.touches && activatorEvent.touches.length > 0) {
      const firstTouch = activatorEvent.touches[0];
      setDragStartPointer({ x: firstTouch.clientX, y: firstTouch.clientY });
      return;
    }
    if (activatorEvent.changedTouches && activatorEvent.changedTouches.length > 0) {
      const firstTouch = activatorEvent.changedTouches[0];
      setDragStartPointer({ x: firstTouch.clientX, y: firstTouch.clientY });
      return;
    }
    if (typeof activatorEvent.clientX === "number" && typeof activatorEvent.clientY === "number") {
      setDragStartPointer({ x: activatorEvent.clientX, y: activatorEvent.clientY });
      return;
    }
    setDragStartPointer(null);
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
          label: "컬렉션 이동",
          value: "move",
          icon: <FiArrowRight size={14} />,
          description: "이 할일을 다른 컬렉션으로 이동합니다.",
          disabled: collections.every((collection) => collection.id === target.collectionId),
        },
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

    if (selected === "move") {
      const movableCollections = collections.filter((collection) => collection.id !== target.collectionId);
      if (movableCollections.length === 0) {
        toast.error("이동할 수 있는 컬렉션이 없어요.", "이동 불가");
        return;
      }
      const moveTargetCollectionId = await actionSheet({
        title: "컬렉션으로 이동",
        message: "이동할 컬렉션을 선택하세요",
        items: movableCollections.map((collection) => ({
          label: collection.name,
          value: collection.id,
          description: `할일 ${collectionCountMap.get(collection.id) ?? 0}개`,
        })),
      });
      if (!moveTargetCollectionId) {
        return;
      }
      onMoveTaskToCollection(taskId, moveTargetCollectionId);
      return;
    }

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
      const confirmed = await confirm({
        title: "할일을 삭제할까요?",
        message: "삭제하면 이 할일의 누적 집중시간/이탈시간 기록도 함께 사라져요.",
        buttons: [
          { label: "취소", value: "cancel", tone: "neutral" },
          { label: "삭제", value: "delete", tone: "danger" },
        ],
      });

      if (confirmed !== "delete") {
        return;
      }

      void onDeleteTask(taskId);
    }
  };

  const handleCollectionMenu = async (collectionId: string) => {
    const target = collections.find((collection) => collection.id === collectionId);
    if (!target || isUncategorizedCollection(target.name)) {
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
              : "컬렉션 삭제 시 할일은 미분류로 이동합니다.",
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
      const confirmed = await confirm({
        title: "컬렉션을 삭제할까요?",
        message: "삭제하면 포함된 할일 아이템은 미분류 컬렉션으로 이동해요.",
        buttons: [
          { label: "취소", value: "cancel", tone: "neutral" },
          { label: "삭제", value: "delete", tone: "danger" },
        ],
      });

      if (confirmed !== "delete") {
        return;
      }

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
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => {
            setDraggingTaskId(null);
            setDraggingCollectionId(null);
            setDragStartPointer(null);
            setDraggingTaskWidth(null);
          }}
        >
          <div className="min-h-0 min-w-0 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
            <div
              className={[
                "no-scrollbar h-full space-y-1.5 pr-0.5",
                draggingTaskId ? "overflow-visible" : "overflow-y-auto",
              ].join(" ")}
            >
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

          <aside ref={collectionPaneRef} className="min-w-0 rounded-xl border border-base-300/75 bg-base-200/35 p-2">
            <div className="space-y-1.5">
              <TaskManagementCollectionItem
                name="전체"
                count={tasks.length}
                active={selectedCollectionId === "all"}
                disableInteraction={Boolean(draggingCollectionId)}
                onSelect={() => onSelectCollection("all")}
              />
              <SortableContext items={collectionDropIds} strategy={verticalListSortingStrategy}>
                {collections.map((collection) => {
                  const active = selectedCollectionId === collection.id;
                  const showCollectionMenu = !isUncategorizedCollection(collection.name);
                  return (
                    <DroppableCollectionItem
                      key={collection.id}
                      collectionId={collection.id}
                      name={collection.name}
                      count={collectionCountMap.get(collection.id) ?? 0}
                      active={active}
                      draggingTaskId={draggingTaskId}
                      draggingCollectionId={draggingCollectionId}
                      onSelect={() => onSelectCollection(collection.id)}
                      onOpenMenu={
                        showCollectionMenu
                          ? () => {
                              void handleCollectionMenu(collection.id);
                            }
                          : undefined
                      }
                    />
                  );
                })}
              </SortableContext>
            </div>
          </aside>
          {typeof document !== "undefined"
            ? createPortal(
                <DragOverlay dropAnimation={null}>
                  {draggingTask ? (
                    <div className="rounded-lg" style={draggingTaskWidth ? { width: `${draggingTaskWidth}px` } : undefined}>
                      <TaskManagementTaskItem
                        label={draggingTask.label}
                        collectionName={collectionNameById.get(draggingTask.collectionId) ?? "미분류"}
                        active={selectedTaskId === draggingTask.id}
                        isDragging
                        disableActions
                        sideButton={{
                          type: "menu",
                          ariaLabel: "할일 옵션",
                          onClick: () => {},
                        }}
                      />
                    </div>
                  ) : null}
                </DragOverlay>,
                document.body
              )
            : null}
        </DndContext>
      </div>
    </div>
  );
}
