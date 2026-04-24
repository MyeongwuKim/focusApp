import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useState } from "react";
import { FiDownload, FiMenu, FiSave, FiTag, FiTrash2 } from "react-icons/fi";
import type { RoutineTemplate, RoutineTemplateItem } from "../../../api/routineTemplateApi";
import { Button } from "../../../components/ui/Button";
import { useSortableItem } from "../../../hooks/useSortableItem";
import { useSortableSensors } from "../../../hooks/useSortableSensors";
import { useTaskCollectionQuery } from "../../../queries";
import { confirm } from "../../../stores";
import { reorderById } from "../../../utils/dnd";

type TodoRoutineImportModalProps = {
  routines: RoutineTemplate[];
  isLoading: boolean;
  onClose: () => void;
  onApply: (routineTemplateId: string) => Promise<void>;
  onUpdateRoutine: (input: {
    routineTemplateId: string;
    items: Array<{
      id?: string;
      taskId?: string | null;
      titleSnapshot?: string | null;
      content: string;
      scheduledTimeHHmm?: string | null;
    }>;
  }) => Promise<void>;
  onDeleteRoutine: (routineTemplateId: string) => Promise<void>;
};

type EditableRoutineItem = {
  id: string;
  taskId: string | null;
  titleSnapshot: string | null;
  content: string;
  scheduledTimeHHmm: string | null;
};

function normalizeRoutineItems(items: RoutineTemplateItem[]): EditableRoutineItem[] {
  return items
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((item) => ({
      id: item.id,
      taskId: item.taskId ?? null,
      titleSnapshot: item.titleSnapshot ?? null,
      content: item.content,
      scheduledTimeHHmm: item.scheduledTimeHHmm ?? null,
    }));
}

function areRoutineItemsEqual(left: EditableRoutineItem[], right: EditableRoutineItem[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((item, index) => {
    const target = right[index];
    if (!target) {
      return false;
    }
    return (
      item.id === target.id &&
      item.taskId === target.taskId &&
      item.titleSnapshot === target.titleSnapshot &&
      item.content === target.content &&
      item.scheduledTimeHHmm === target.scheduledTimeHHmm
    );
  });
}

function SortableRoutineItemRow({
  item,
  collectionName,
  onDelete,
  editable,
}: {
  item: EditableRoutineItem;
  collectionName: string | null;
  onDelete: (itemId: string) => void;
  editable: boolean;
}) {
  const { setNodeRef, style, isDragging, dragHandleProps } = useSortableItem({
    id: item.id,
    disabled: !editable,
  });

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-lg border border-base-300/70 bg-base-100 px-2 py-1.5 text-sm text-base-content/80",
        isDragging ? "shadow-md" : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
        {editable ? (
          <Button
            variant="ghost"
            size="xs"
            circle
            aria-label="루틴 항목 순서 변경"
            className="text-base-content/50"
            {...dragHandleProps}
          >
            <FiMenu size={12} />
          </Button>
        ) : null}
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate">{item.content}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2">
            <p className="m-0 truncate text-[11px] text-base-content/55">
              <FiTag size={11} className="mr-1 inline-block" />
              {collectionName ?? "컬렉션 없음"}
            </p>
            <p className="m-0 truncate text-[11px] text-base-content/55">
              {item.scheduledTimeHHmm ? `시간 ${item.scheduledTimeHHmm}` : "시간 미설정"}
            </p>
          </div>
        </div>
        {editable ? (
          <Button
            variant="ghost"
            size="xs"
            circle
            aria-label="루틴 항목 삭제"
            className="text-error"
            onClick={() => onDelete(item.id)}
          >
            <FiTrash2 size={12} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function TodoRoutineImportModal({
  routines,
  isLoading,
  onClose,
  onApply,
  onUpdateRoutine,
  onDeleteRoutine,
}: TodoRoutineImportModalProps) {
  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const collections = taskCollectionsQuery.data ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editableItems, setEditableItems] = useState<EditableRoutineItem[]>([]);
  const [isApplying, setIsApplying] = useState(false);
  const [isSavingRoutine, setIsSavingRoutine] = useState(false);
  const [isDeletingRoutine, setIsDeletingRoutine] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  const sensors = useSortableSensors();

  useEffect(() => {
    if (!selectedId && routines.length > 0) {
      setSelectedId(routines[0]?.id ?? null);
      return;
    }

    if (selectedId && !routines.some((routine) => routine.id === selectedId)) {
      setSelectedId(routines[0]?.id ?? null);
    }
  }, [routines, selectedId]);

  const selectedRoutine = useMemo(
    () => routines.find((routine) => routine.id === selectedId) ?? null,
    [routines, selectedId]
  );

  const selectedRoutineItems = useMemo(
    () => (selectedRoutine ? normalizeRoutineItems(selectedRoutine.items) : []),
    [selectedRoutine]
  );
  const collectionNameByTaskId = useMemo(() => {
    const mapping = new Map<string, string>();
    for (const collection of collections) {
      for (const task of collection.tasks) {
        mapping.set(task.id, collection.name);
      }
    }
    return mapping;
  }, [collections]);

  useEffect(() => {
    setEditableItems(selectedRoutineItems);
  }, [selectedRoutineItems, selectedId]);

  const hasUnsavedChanges = useMemo(
    () => !areRoutineItemsEqual(editableItems, selectedRoutineItems),
    [editableItems, selectedRoutineItems]
  );

  const handleApply = async () => {
    if (!selectedId || isApplying) {
      return;
    }
    setIsApplying(true);
    try {
      await onApply(selectedId);
      onClose();
    } finally {
      setIsApplying(false);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    setEditableItems((prev) => reorderById(prev, String(active.id), String(over.id), (item) => item.id));
  };

  const handleDeleteRoutineItem = (itemId: string) => {
    setEditableItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const handleSaveRoutineChanges = async () => {
    if (!selectedRoutine || isSavingRoutine || !isEditMode) {
      return;
    }

    setIsSavingRoutine(true);
    try {
      await onUpdateRoutine({
        routineTemplateId: selectedRoutine.id,
        items: editableItems.map((item) => ({
          id: item.id,
          taskId: item.taskId,
          titleSnapshot: item.titleSnapshot,
          content: item.content,
          scheduledTimeHHmm: item.scheduledTimeHHmm,
        })),
      });
      setIsEditMode(false);
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!selectedRoutine || isDeletingRoutine) {
      return;
    }

    const accepted = await confirm({
      title: "루틴을 삭제할까요?",
      message: "삭제하면 루틴에 담긴 항목도 함께 사라져요.",
      buttons: [
        { label: "취소", value: "cancel", tone: "neutral" },
        { label: "삭제", value: "delete", tone: "danger" },
      ],
    });

    if (accepted !== "delete") {
      return;
    }

    setIsDeletingRoutine(true);
    try {
      await onDeleteRoutine(selectedRoutine.id);
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-base-100">
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 p-2 md:grid-cols-[12rem_minmax(0,1fr)]">
        <div className="min-h-0 min-w-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          <div className="no-scrollbar max-h-40 space-y-1.5 overflow-y-auto pr-0.5 md:h-full md:max-h-none">
            {isLoading ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">루틴 불러오는 중...</p>
            ) : null}
            {!isLoading && routines.length === 0 ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">저장된 루틴이 없어요.</p>
            ) : null}
            {routines.map((routine) => {
              const active = routine.id === selectedId;
              return (
                <Button
                  key={routine.id}
                  block
                  className={[
                    "max-w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/12 text-primary"
                      : "border-base-300/70 bg-base-100 text-base-content/80",
                  ].join(" ")}
                  onClick={() => setSelectedId(routine.id)}
                >
                  <p className="m-0 truncate text-sm font-semibold">{routine.name}</p>
                  <p className="m-0 mt-0.5 truncate text-xs text-base-content/60">{routine.items.length}개 항목</p>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 min-w-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          {isEditMode ? (
            <div className="mb-1 rounded-md border border-info/30 bg-info/10 px-2 py-1 text-[11px] text-info">
              편집 모드: 드래그로 순서 변경, 휴지통으로 항목 삭제
            </div>
          ) : null}
          <div className="no-scrollbar max-h-[40svh] space-y-1.5 overflow-y-auto pr-0.5 md:h-full md:max-h-none">
            {selectedRoutine ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={isEditMode ? handleDragEnd : undefined}
              >
                <SortableContext
                  items={editableItems.map((item) => item.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div className="space-y-1.5">
                    {editableItems.map((item) => (
                      <SortableRoutineItemRow
                        key={item.id}
                        item={item}
                        collectionName={item.taskId ? collectionNameByTaskId.get(item.taskId) ?? null : null}
                        onDelete={handleDeleteRoutineItem}
                        editable={isEditMode}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">
                루틴을 선택하면 항목이 보입니다.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="shrink-0 space-y-1.5 border-t border-base-300/80 bg-base-100 p-2">
        {isEditMode ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              className="h-9 min-h-9 flex-1 rounded-xl"
              disabled={!selectedRoutine || !hasUnsavedChanges || isSavingRoutine}
              onClick={handleSaveRoutineChanges}
            >
              <FiSave size={14} />
              {isSavingRoutine ? "저장 중..." : "루틴 변경 저장"}
            </Button>
            <Button
              variant="outline"
              className="h-9 min-h-9 rounded-xl border-error/40 text-error hover:border-error/60"
              disabled={!selectedRoutine || isDeletingRoutine}
              onClick={handleDeleteRoutine}
            >
              <FiTrash2 size={14} />
              {isDeletingRoutine ? "삭제 중..." : "루틴 삭제"}
            </Button>
            <Button
              variant="ghost"
              className="h-9 min-h-9 rounded-xl px-3"
              onClick={() => setIsEditMode(false)}
            >
              편집 종료
            </Button>
          </div>
        ) : null}
        {!isEditMode ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              className="h-10 min-h-10 rounded-xl"
              disabled={!selectedRoutine}
              onClick={() => setIsEditMode(true)}
            >
              편집
            </Button>
            <Button
              variant="primary"
              block
              className="h-10 min-h-10 flex-1 rounded-xl"
              disabled={!selectedRoutine || isApplying}
              onClick={handleApply}
            >
              <FiDownload size={14} />
              {isApplying ? "불러오는 중..." : "선택한 루틴 추가"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
