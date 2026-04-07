import { useEffect, useMemo, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { DateTodosSortableList } from "../../components/DateTodosSortableList";
import type { TaskItem } from "../../types";
import { useDateTodosRouteContext } from "../DateTodosRouteProvider";

export function DateTodosBoard() {
  const {
    items,
    reorderTasksByIds,
    handleDateTaskAction,
    handleEditActualFocus,
    handleDateTaskMenuAction,
  } = useDateTodosRouteContext();
  const [orderedIds, setOrderedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [longPressActivatedId, setLongPressActivatedId] = useState<string | null>(null);

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
    return orderedIds.map((id) => itemMap.get(id)).filter((item): item is TaskItem => Boolean(item));
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
        <DateTodosSortableList
          orderedIds={orderedIds}
          orderedItems={orderedItems}
          draggingId={draggingId}
          longPressActivatedId={longPressActivatedId}
          onDragStart={setDraggingId}
          onDragEnd={handleDragEnd}
          onDragCancel={clearDraggingState}
          onTaskAction={handleDateTaskAction}
          onEditActualFocus={handleEditActualFocus}
          onTaskMenuAction={handleDateTaskMenuAction}
        />
      </div>
    </div>
  );
}
