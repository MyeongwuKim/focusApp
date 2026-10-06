import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useEffect, useMemo, useRef, useState } from "react";
import { FiDownload, FiSave, FiTag, FiTrash2 } from "react-icons/fi";
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

const POST_EDIT_ACTION_LOCK_MS = 420;

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
      {...(editable ? dragHandleProps : {})}
      className={[
        "routine-bundle-task-row rounded-lg border border-base-300/70 bg-base-100 px-2 py-1.5 text-sm text-base-content/80 transition-[border-color,background-color,box-shadow]",
        isDragging
          ? "border-primary/65 bg-base-100 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_10px_24px_rgba(0,0,0,0.22)]"
          : "",
      ].join(" ")}
    >
      <div className="flex items-center gap-1.5">
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
            aria-label="묶음 항목 삭제"
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
  const [isPostEditActionLocked, setIsPostEditActionLocked] = useState(false);
  const postEditActionLockTimerRef = useRef<number | null>(null);

  const sensors = useSortableSensors();

  const lockPostEditActions = () => {
    if (postEditActionLockTimerRef.current !== null) {
      window.clearTimeout(postEditActionLockTimerRef.current);
    }
    setIsPostEditActionLocked(true);
    postEditActionLockTimerRef.current = window.setTimeout(() => {
      postEditActionLockTimerRef.current = null;
      setIsPostEditActionLocked(false);
    }, POST_EDIT_ACTION_LOCK_MS);
  };

  useEffect(() => {
    return () => {
      if (postEditActionLockTimerRef.current !== null) {
        window.clearTimeout(postEditActionLockTimerRef.current);
      }
    };
  }, []);

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
    if (!selectedId || isApplying || isPostEditActionLocked) {
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
      lockPostEditActions();
    } finally {
      setIsSavingRoutine(false);
    }
  };

  const handleDeleteRoutine = async () => {
    if (!selectedRoutine || isDeletingRoutine) {
      return;
    }

    const accepted = await confirm({
      title: "할 일 묶음을 삭제할까요?",
      message: "삭제하면 묶음에 담긴 항목도 함께 사라져요.",
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
      lockPostEditActions();
    } finally {
      setIsDeletingRoutine(false);
    }
  };

  return (
    <div className="routine-bundle-import flex min-h-0 flex-1 flex-col bg-transparent">
      <div className="routine-bundle-intro flex shrink-0 items-end justify-between gap-3 px-3 pb-2 pt-1">
        <div>
          <p className="m-0 text-sm font-semibold text-base-content/85">오늘에 가져올 묶음을 골라보세요</p>
          <p className="m-0 mt-0.5 text-xs text-base-content/55">고른 항목은 현재 날짜의 할 일에 이어서 적혀요.</p>
        </div>
        <span className="shrink-0 text-[11px] text-base-content/55">{routines.length}개 저장</span>
      </div>

      <div className="routine-bundle-layout grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] gap-2 px-2 pb-2 md:grid-cols-[12rem_minmax(0,1fr)] md:grid-rows-1">
        <div className="routine-bundle-list min-h-0 min-w-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {isLoading ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">묶음 불러오는 중...</p>
            ) : null}
            {!isLoading && routines.length === 0 ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">저장된 할 일 묶음이 없어요.</p>
            ) : null}
            {routines.map((routine) => {
              const active = routine.id === selectedId;
              return (
                <Button
                  key={routine.id}
                  block
                  className={[
                    "routine-bundle-choice max-w-full overflow-hidden rounded-lg border px-2.5 py-2 text-left transition-colors",
                    active
                      ? "border-primary/60 bg-primary/12 text-primary"
                      : "border-base-300/70 bg-base-100 text-base-content/80",
                  ].join(" ")}
                  data-active={active ? "true" : "false"}
                  onClick={() => setSelectedId(routine.id)}
                >
                  <p className="m-0 truncate text-sm font-semibold">{routine.name}</p>
                  <p className="m-0 mt-0.5 truncate text-xs text-base-content/60">{routine.items.length}개 항목</p>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="routine-bundle-detail flex min-h-0 min-w-0 flex-col rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          {isEditMode ? (
            <div className="mb-1 rounded-md border border-info/30 bg-info/10 px-2 py-1 text-[11px] text-info">
              편집 모드: 드래그로 순서 변경, 휴지통으로 항목 삭제
            </div>
          ) : null}
          {selectedRoutine ? (
            <div className="routine-bundle-detail__heading mb-1.5 flex shrink-0 items-center justify-between gap-2 px-1">
              <p className="m-0 truncate text-sm font-semibold text-base-content/85">{selectedRoutine.name}</p>
              <span className="shrink-0 text-[11px] text-base-content/55">{editableItems.length}개 할 일</span>
            </div>
          ) : null}
          <div className="no-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-0.5">
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
                할 일 묶음을 선택하면 내용이 보여요.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="routine-bundle-actions shrink-0 space-y-1.5 border-t border-base-300/80 bg-transparent p-2">
        {isEditMode ? (
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              className="h-9 min-h-9 flex-1 rounded-xl"
              disabled={!selectedRoutine || !hasUnsavedChanges || isSavingRoutine}
              onClick={handleSaveRoutineChanges}
            >
              <FiSave size={14} />
              {isSavingRoutine ? "저장 중..." : "묶음 변경 저장"}
            </Button>
            <Button
              variant="outline"
              className="h-9 min-h-9 rounded-xl border-error/40 text-error hover:border-error/60"
              disabled={!selectedRoutine || isDeletingRoutine}
              onClick={handleDeleteRoutine}
            >
              <FiTrash2 size={14} />
              {isDeletingRoutine ? "삭제 중..." : "묶음 삭제"}
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
              묶음 편집
            </Button>
            <Button
              variant="primary"
              block
              className="h-10 min-h-10 flex-1 rounded-xl"
              disabled={!selectedRoutine || isApplying || isPostEditActionLocked}
              onClick={handleApply}
            >
              <FiDownload size={14} />
              {isApplying ? "불러오는 중..." : "오늘에 추가"}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
