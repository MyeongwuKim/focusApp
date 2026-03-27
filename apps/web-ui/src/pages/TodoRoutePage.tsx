import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  MouseSensor,
  KeyboardSensor,
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
import { FiAward } from "react-icons/fi";
import { TodoItemCard } from "../features/todo/components/TodoItemCard";
import { TodoQuickActions } from "../features/todo/components/TodoQuickActions";
import { TodoProgressFooter } from "../features/todo/components/TodoProgressFooter";
import type { TaskItem } from "../features/todo/types";

type TodoRoutePageProps = {
  items: TaskItem[];
  emptyMessage?: string;
  summary: {
    completedCount: number;
    totalCount: number;
    totalMinutes: number;
    progressPercent: number;
  };
  session: {
    focusMinutes: number;
    restMinutes: number;
    active: "focus" | "rest" | null;
  };
  onTaskAction: (taskId: string, action: "start" | "pause" | "resume" | "complete") => void;
  onToggleFocus: () => void;
  onToggleRest: () => void;
  onOpenMemo: () => void;
  onReorderTasks: (orderedIds: string[]) => void;
  showClearStamp?: boolean;
  onCloseClearStamp?: () => void;
};

function SortableTaskRow({
  item,
  onTaskAction,
  disableActions,
  isLongPressActive,
}: {
  item: TaskItem;
  onTaskAction: TodoRoutePageProps["onTaskAction"];
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
        disableActions={disableActions}
        isDragging={isDragging}
        isLongPressActive={isLongPressActive}
      />
    </div>
  );
}

export function TodoRoutePage({
  items,
  emptyMessage = "이 날짜에는 할 일이 없어요.",
  summary,
  session,
  onTaskAction,
  onToggleFocus,
  onToggleRest,
  onOpenMemo,
  onReorderTasks,
  showClearStamp = false,
  onCloseClearStamp,
}: TodoRoutePageProps) {
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
    const { active, over } = event;
    setDraggingId(null);
    setLongPressActivatedId(null);

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
      onReorderTasks(next);
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
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
      {showClearStamp ? (
        <button
          type="button"
          className="absolute inset-0 z-30 grid place-items-center bg-base-300/35 backdrop-blur-[1px]"
          onClick={onCloseClearStamp}
          aria-label="완료 스탬프 닫기"
        >
          <div className="-rotate-6 rounded-full border-4 border-success bg-success/18 px-9 py-8 text-success shadow-[0_14px_30px_rgba(16,185,129,0.24)]">
            <div className="flex items-center justify-center gap-2 text-lg font-extrabold tracking-wide">
              <FiAward size={22} />
              참 잘했어요
            </div>
            <div className="mt-1 text-center text-xs font-semibold text-success/85">TODAY CLEAR</div>
          </div>
        </button>
      ) : null}
      <div className="min-h-0 flex-1 rounded-xl border border-base-300/80 bg-base-100/65 p-2.5">
        <div className="no-scrollbar min-h-0 h-full space-y-2 overflow-y-auto pr-0.5">
          {orderedItems.length > 0 ? (
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(event) => setDraggingId(String(event.active.id))}
              onDragEnd={handleDragEnd}
              onDragCancel={() => {
                setDraggingId(null);
                setLongPressActivatedId(null);
              }}
            >
              <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {orderedItems.map((item) => (
                    <SortableTaskRow
                      key={item.id}
                      item={item}
                      onTaskAction={onTaskAction}
                      disableActions={Boolean(draggingId)}
                      isLongPressActive={longPressActivatedId === item.id}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <p className="m-0 px-1 py-2 text-sm text-base-content/70">{emptyMessage}</p>
          )}
        </div>
      </div>

      <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
        <TodoQuickActions onOpenMemo={onOpenMemo} />
        <TodoProgressFooter
          summary={summary}
          session={session}
          onToggleFocus={onToggleFocus}
          onToggleRest={onToggleRest}
        />
      </div>
    </section>
  );
}
