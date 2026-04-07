import {
  DndContext,
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
import { FiClipboard } from "react-icons/fi";
import type { TaskItem } from "../types";
import { TodoItemCard } from "./TodoItemCard";

type DateTodosSortableListProps = {
  orderedIds: string[];
  orderedItems: TaskItem[];
  draggingId: string | null;
  longPressActivatedId: string | null;
  onDragStart: (taskId: string) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: () => void;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onEditActualFocus: (taskId: string) => void;
  onTaskMenuAction: (taskId: string) => void;
};

function SortableTaskRow({
  item,
  onTaskAction,
  onEditActualFocus,
  onTaskMenuAction,
  disableActions,
  isLongPressActive,
}: {
  item: TaskItem;
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onEditActualFocus: (taskId: string) => void;
  onTaskMenuAction: (taskId: string) => void;
  disableActions: boolean;
  isLongPressActive: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <TodoItemCard
        item={item}
        onTaskAction={onTaskAction}
        onEditActualFocus={onEditActualFocus}
        onOpenMenu={onTaskMenuAction}
        disableActions={disableActions}
        isDragging={isDragging}
        isLongPressActive={isLongPressActive}
      />
    </div>
  );
}

export function DateTodosSortableList({
  orderedIds,
  orderedItems,
  draggingId,
  longPressActivatedId,
  onDragStart,
  onDragEnd,
  onDragCancel,
  onTaskAction,
  onEditActualFocus,
  onTaskMenuAction,
}: DateTodosSortableListProps) {
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

  if (orderedItems.length === 0) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
          <FiClipboard size={20} />
        </span>
        <p className="m-0 text-base font-semibold tracking-tight text-base-content/80">
          지금은 비어 있어요. 작은 할 일부터 시작해볼까요?
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(event) => onDragStart(String(event.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={onDragCancel}
    >
      <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {orderedItems.map((item) => (
            <SortableTaskRow
              key={item.id}
              item={item}
              onTaskAction={onTaskAction}
              onEditActualFocus={onEditActualFocus}
              onTaskMenuAction={onTaskMenuAction}
              disableActions={Boolean(draggingId)}
              isLongPressActive={longPressActivatedId === item.id}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
