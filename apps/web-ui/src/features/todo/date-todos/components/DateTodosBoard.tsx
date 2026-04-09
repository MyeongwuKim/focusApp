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
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useState } from "react";
import { FiClipboard, FiDownload, FiPlus } from "react-icons/fi";
import { Button } from "../../../../components/ui/Button";
import { TodoItemCard } from "../../components/TodoItemCard";
import type { TaskItem } from "../../types";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

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

export function DateTodosBoard() {
  const {
    items,
    isItemsHydrating,
    reorderTasksByIds,
    handleDateTaskAction,
    handleEditActualFocus,
    handleDateTaskMenuAction,
    openRoutineImport,
    openRoutineCreate,
  } = useDateTodosRouteContext();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [longPressActivatedId, setLongPressActivatedId] = useState<string | null>(null);
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

  useEffect(() => {
    setOrderedIds((prev) => {
      const nextIds = items.map((item) => item.id);
      if (prev.length === 0) {
        return nextIds;
      }
      const nextSet = new Set(nextIds);
      const kept = prev.filter((id) => nextSet.has(id));
      const appended = nextIds.filter((id) => !kept.includes(id));
      return [...kept, ...appended];
    });
  }, [items]);

  const orderedItems = useMemo(() => {
    const itemMap = new Map(items.map((item) => [item.id, item]));
    const baseOrderedIds =
      orderedIds.length > 0
        ? orderedIds
        : items.map((item) => item.id);
    return baseOrderedIds.map((id) => itemMap.get(id)).filter((item): item is TaskItem => Boolean(item));
  }, [items, orderedIds]);

  const clearDraggingState = () => {
    setDraggingId(null);
    setLongPressActivatedId(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    clearDraggingState();

    if (!over || active.id === over.id) {
      return;
    }

    setOrderedIds((prev) => {
      const oldIndex = prev.indexOf(String(active.id));
      const newIndex = prev.indexOf(String(over.id));
      if (oldIndex < 0 || newIndex < 0) {
        return prev;
      }
      const next = arrayMove(prev, oldIndex, newIndex);
      reorderTasksByIds(next);
      return next;
    });
  };

  useEffect(() => {
    if (!draggingId) {
      return;
    }
    setLongPressActivatedId(draggingId);
    const timer = window.setTimeout(() => {
      setLongPressActivatedId(null);
    }, 480);
    return () => window.clearTimeout(timer);
  }, [draggingId]);

  return (
    <div className="min-h-0 flex-1 rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
      <div className="no-scrollbar min-h-0 h-full space-y-2 overflow-y-auto pr-0.5">
        {isItemsHydrating ? (
          <div className="space-y-2">
            <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
            <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
            <div className="h-20 animate-pulse rounded-lg border border-base-300/70 bg-base-200/55" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex min-h-full flex-col items-center justify-center gap-4 px-3 py-6 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-base-200 text-base-content/60">
              <FiClipboard size={20} />
            </span>
            <div className="space-y-1">
              <p className="m-0 text-base font-semibold tracking-tight text-base-content/85">오늘 할 일이 비어 있어요</p>
              <p className="m-0 text-xs text-base-content/60">루틴을 불러오거나 새 루틴을 만들어 빠르게 시작해보세요.</p>
            </div>
            <div className="flex w-full max-w-xs gap-2">
              <Button variant="primary" className="flex-1 rounded-lg" onClick={openRoutineImport}>
                <FiDownload size={13} />
                루틴 불러오기
              </Button>
              <Button variant="outline" className="flex-1 rounded-lg" onClick={openRoutineCreate}>
                <FiPlus size={13} />
                루틴 만들기
              </Button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={(event) => setDraggingId(String(event.active.id))}
            onDragEnd={handleDragEnd}
            onDragCancel={clearDraggingState}
          >
            <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {orderedItems.map((item) => (
                  <SortableTaskRow
                    key={item.id}
                    item={item}
                    onTaskAction={handleDateTaskAction}
                    onEditActualFocus={handleEditActualFocus}
                    onTaskMenuAction={handleDateTaskMenuAction}
                    disableActions={Boolean(draggingId)}
                    isLongPressActive={longPressActivatedId === item.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
