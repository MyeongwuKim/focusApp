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
import { FiCheck, FiMenu, FiPlus, FiTag, FiX } from "react-icons/fi";
import { SelectDropbox } from "../../../components/SelectDropbox";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";
import { useTaskCollectionMutation, useTaskCollectionQuery } from "../../../queries";
import { actionSheet, toast } from "../../../stores";

type RoutineDraftItem = {
  taskId?: string | null;
  titleSnapshot?: string | null;
  content: string;
  scheduledTimeHHmm?: string | null;
};

type TodoRoutineCreateModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (input: {
    name: string;
    items: RoutineDraftItem[];
  }) => Promise<void>;
};

type SortableSelectedTaskRowProps = {
  task: {
    id: string;
    title: string;
    collectionName: string;
  };
  scheduledTime: string | null;
  onRemove: (taskId: string) => void;
  onChangeTime: (taskId: string, nextTime: string | null) => void;
};

function SortableSelectedTaskRow({ task, scheduledTime, onRemove, onChangeTime }: SortableSelectedTaskRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "rounded-lg border border-base-300/70 bg-base-100 px-2.5 py-2 transition-shadow",
        isDragging ? "shadow-md" : "",
      ].join(" ")}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <Button
            variant="ghost"
            size="xs"
            circle
            aria-label="순서 변경"
            className="text-base-content/45"
            {...attributes}
            {...listeners}
          >
            <FiMenu size={12} />
          </Button>
          <div className="min-w-0">
            <p className="m-0 truncate text-sm font-medium text-base-content/80">{task.title}</p>
            <p className="m-0 mt-0.5 truncate text-[11px] text-base-content/55">
              <FiTag size={11} className="mr-1 inline-block" />
              {task.collectionName}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="xs" circle aria-label="항목 제외" className="text-error" onClick={() => onRemove(task.id)}>
          <FiX size={12} />
        </Button>
      </div>
      <InputField
        type="time"
        className="h-8 min-h-8 w-full rounded-lg text-sm"
        value={scheduledTime ?? ""}
        onChange={(event) => onChangeTime(task.id, event.target.value || null)}
      />
    </div>
  );
}

export function TodoRoutineCreateModal({ isOpen, onClose, onCreate }: TodoRoutineCreateModalProps) {
  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const { data: collections = [], isLoading: isTaskLoading } = taskCollectionsQuery;
  const { createTaskCollectionMutation, addTaskMutation } = useTaskCollectionMutation();

  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [name, setName] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedTaskTimes, setSelectedTaskTimes] = useState<Record<string, string | null>>({});
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("all");
  const [quickCreateMode, setQuickCreateMode] = useState<"collection" | "task" | null>(null);
  const [quickName, setQuickName] = useState("");
  const [quickTaskCollectionId, setQuickTaskCollectionId] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isQuickSaving, setIsQuickSaving] = useState(false);
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
    let rafId: number | null = null;
    let timeoutId: number | null = null;

    if (isOpen) {
      setShouldRender(true);
      rafId = window.requestAnimationFrame(() => {
        setIsVisible(true);
      });
    } else {
      setIsVisible(false);
      timeoutId = window.setTimeout(() => {
        setShouldRender(false);
      }, 240);
    }

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setName("");
      setSelectedTaskIds([]);
      setSelectedTaskTimes({});
      setSelectedCollectionId("all");
      setQuickCreateMode(null);
      setQuickName("");
      setQuickTaskCollectionId("");
    }
  }, [isOpen]);

  const allTasks = useMemo(
    () =>
      collections.flatMap((collection) =>
        collection.tasks
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((task) => ({
            id: task.id,
            title: task.title,
            collectionId: collection.id,
            collectionName: collection.name,
          }))
      ),
    [collections]
  );

  const visibleTasks = useMemo(() => {
    if (selectedCollectionId === "all") {
      return allTasks;
    }
    return allTasks.filter((task) => task.collectionId === selectedCollectionId);
  }, [allTasks, selectedCollectionId]);

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const exists = prev.includes(taskId);
      if (exists) {
        setSelectedTaskTimes((current) => {
          const next = { ...current };
          delete next[taskId];
          return next;
        });
        return prev.filter((id) => id !== taskId);
      }
      return [...prev, taskId];
    });
  };

  const selectedTasks = useMemo(() => {
    const taskById = new Map(allTasks.map((task) => [task.id, task] as const));
    return selectedTaskIds
      .map((taskId) => taskById.get(taskId))
      .filter((task): task is NonNullable<typeof task> => Boolean(task));
  }, [allTasks, selectedTaskIds]);

  const handleSelectedTaskDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = selectedTaskIds.findIndex((id) => id === String(active.id));
    const newIndex = selectedTaskIds.findIndex((id) => id === String(over.id));
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    setSelectedTaskIds((prev) => arrayMove(prev, oldIndex, newIndex));
  };

  const handleSave = async () => {
    if (isSaving) {
      return;
    }

    const taskById = new Map(allTasks.map((task) => [task.id, task] as const));
    const payloadItems = selectedTaskIds
      .map((taskId) => {
        const task = taskById.get(taskId);
        if (!task) {
          return null;
        }
        return {
          taskId: task.id,
          titleSnapshot: task.title,
          content: task.title,
          scheduledTimeHHmm: selectedTaskTimes[task.id] ?? null,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (payloadItems.length === 0) {
      return;
    }

    setIsSaving(true);
    try {
      await onCreate({
        name,
        items: payloadItems,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenQuickCreateMenu = async () => {
    const selected = await actionSheet({
      title: "빠른 추가",
      message: "추가할 항목을 선택하세요",
      items: [
        {
          label: "컬렉션 추가",
          value: "collection",
          tone: "primary",
          icon: <FiPlus size={14} />,
          description: "새 컬렉션을 만듭니다.",
        },
        {
          label: "할일 추가",
          value: "task",
          tone: "primary",
          icon: <FiPlus size={14} />,
          description: "선택 컬렉션에 할일을 추가합니다.",
        },
      ],
    });

    if (selected === "collection") {
      setQuickCreateMode("collection");
      setQuickName("");
      return;
    }

    if (selected === "task") {
      if (collections.length === 0) {
        toast.show({
          type: "error",
          title: "추가 불가",
          message: "먼저 컬렉션을 만들어 주세요.",
          duration: 2200,
        });
        return;
      }
      const initialCollectionId =
        selectedCollectionId !== "all" ? selectedCollectionId : collections[0]?.id ?? "";
      setQuickCreateMode("task");
      setQuickTaskCollectionId(initialCollectionId);
      setQuickName("");
    }
  };

  const handleSaveQuickCreate = async () => {
    const name = quickName.trim();
    if (!name || !quickCreateMode || isQuickSaving) {
      return;
    }

    setIsQuickSaving(true);
    try {
      if (quickCreateMode === "collection") {
        const created = await createTaskCollectionMutation.mutateAsync({ name });
        setSelectedCollectionId(created.id);
        toast.show({
          type: "positive",
          title: "컬렉션 추가됨",
          message: `${created.name} 컬렉션을 만들었어요.`,
          duration: 1800,
        });
      }

      if (quickCreateMode === "task") {
        const targetCollectionId =
          quickTaskCollectionId || (selectedCollectionId !== "all" ? selectedCollectionId : "");
        if (!targetCollectionId) {
          toast.show({
            type: "error",
            title: "추가 실패",
            message: "컬렉션을 선택해 주세요.",
            duration: 2200,
          });
          return;
        }

        const createdTask = await addTaskMutation.mutateAsync({
          collectionId: targetCollectionId,
          title: name,
        });
        setSelectedTaskIds((prev) => (prev.includes(createdTask.id) ? prev : [...prev, createdTask.id]));
        setSelectedCollectionId(targetCollectionId);
        toast.show({
          type: "positive",
          title: "할일 추가됨",
          message: "새 할일을 추가하고 바로 선택했어요.",
          duration: 1800,
        });
      }

      setQuickCreateMode(null);
      setQuickName("");
    } catch (error) {
      const message = error instanceof Error ? error.message : "추가 중 오류가 발생했어요.";
      toast.show({
        type: "error",
        title: "추가 실패",
        message,
        duration: 2200,
      });
    } finally {
      setIsQuickSaving(false);
    }
  };

  const hasValidName = name.trim().length > 0;
  const hasValidItems = selectedTaskIds.length > 0;
  const canSave = hasValidName && hasValidItems && !isSaving;

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={[
        "absolute inset-0 z-40 transition-opacity duration-250 ease-out",
        isVisible ? "opacity-100" : "opacity-0",
      ].join(" ")}
    >
      <div
        className={[
          "absolute inset-0 flex flex-col bg-base-100 transition-[transform,opacity] duration-250 ease-out",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90",
        ].join(" ")}
      >
        <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_44px] items-center border-b border-base-300/80 px-2">
          <Button variant="ghost" size="sm" circle aria-label="루틴 만들기 닫기" onClick={onClose}>
            <FiX size={18} />
          </Button>
          <h2 className="m-0 text-center text-sm font-semibold text-base-content">루틴 만들기</h2>
          <div aria-hidden="true" />
        </header>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          <div className="rounded-xl border border-base-300/80 bg-base-200/35 p-2.5">
            <label className="mb-1 block text-xs font-semibold text-base-content/75">루틴 이름</label>
            <InputField
              className="h-10 w-full rounded-lg"
              placeholder="예: 평일 아침 루틴"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="rounded-xl border border-base-300/80 bg-base-200/35 p-2.5">
            <div className="mb-2 flex items-center gap-2">
              <SelectDropbox
                className="h-9 min-h-9 flex-1 rounded-lg"
                value={selectedCollectionId}
                onValueChange={setSelectedCollectionId}
                options={[
                  { value: "all", label: "전체" },
                  ...collections.map((collection) => ({
                    value: collection.id,
                    label: collection.name,
                  })),
                ]}
              />
              <Button
                variant="outline"
                square
                className="h-9 min-h-9 w-9 rounded-lg"
                aria-label="컬렉션 또는 할일 추가"
                onClick={() => {
                  void handleOpenQuickCreateMenu();
                }}
              >
                <FiPlus size={14} />
              </Button>
            </div>
            {quickCreateMode ? (
              <div className="mb-2 rounded-lg border border-base-300/70 bg-base-100 p-2">
                <p className="m-0 mb-1 text-xs font-semibold text-base-content/70">
                  {quickCreateMode === "collection" ? "컬렉션 추가" : "할일 추가"}
                </p>
                {quickCreateMode === "task" ? (
                  <SelectDropbox
                    className="mb-1.5 h-8 min-h-8 w-full rounded-lg text-xs"
                    value={quickTaskCollectionId}
                    onValueChange={setQuickTaskCollectionId}
                    options={collections.map((collection) => ({
                      value: collection.id,
                      label: collection.name,
                    }))}
                  />
                ) : null}
                <div className="flex items-center gap-1.5">
                  <InputField
                    className="h-8 min-h-8 flex-1 rounded-lg text-sm"
                    placeholder={quickCreateMode === "collection" ? "새 컬렉션 이름" : "새 할일 이름"}
                    value={quickName}
                    onChange={(event) => setQuickName(event.target.value)}
                  />
                  <Button
                    variant="primary"
                    size="xs"
                    className="h-8 min-h-8 rounded-lg px-2.5"
                    onClick={() => {
                      void handleSaveQuickCreate();
                    }}
                    disabled={!quickName.trim() || isQuickSaving}
                  >
                    저장
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="h-8 min-h-8 rounded-lg px-2.5"
                    onClick={() => {
                      setQuickCreateMode(null);
                      setQuickName("");
                    }}
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="no-scrollbar h-56 space-y-1.5 overflow-y-auto pr-0.5 md:h-72">
              {isTaskLoading ? (
                <p className="m-0 px-1 py-2 text-sm text-base-content/60">할일 불러오는 중...</p>
              ) : null}
              {!isTaskLoading && visibleTasks.length === 0 ? (
                <p className="m-0 px-1 py-2 text-sm text-base-content/60">선택 가능한 할일이 없어요.</p>
              ) : null}
              {visibleTasks.map((task) => {
                const selected = selectedTaskIds.includes(task.id);
                return (
                  <Button
                    key={task.id}
                    className={[
                      "flex w-full items-center justify-between rounded-lg border px-2.5 py-2 text-left transition-colors",
                      selected
                        ? "border-primary/60 bg-primary/12 text-primary"
                        : "border-base-300/70 bg-base-100 text-base-content/80",
                    ].join(" ")}
                    onClick={() => toggleTaskSelection(task.id)}
                  >
                    <div>
                      <p className="m-0 text-sm font-medium">{task.title}</p>
                      <p className="m-0 mt-0.5 text-xs text-base-content/60">
                        <FiTag size={11} className="mr-1 inline-block" />
                        {task.collectionName}
                      </p>
                    </div>
                    {selected ? <FiCheck size={14} /> : null}
                  </Button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-base-300/80 bg-base-200/35 p-2.5">
            <p className="m-0 mb-2 text-xs font-semibold text-base-content/75">
              선택한 할일 ({selectedTaskIds.length})
            </p>
            <div className="no-scrollbar max-h-44 space-y-1.5 overflow-y-auto pr-0.5 md:max-h-56">
              {selectedTasks.length === 0 ? (
                <p className="m-0 px-1 py-2 text-sm text-base-content/60">
                  위 목록에서 루틴에 넣을 할일을 선택해 주세요.
                </p>
              ) : null}
              {selectedTasks.length > 0 ? (
                <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSelectedTaskDragEnd}>
                  <SortableContext items={selectedTaskIds} strategy={verticalListSortingStrategy}>
                    <div className="space-y-1.5">
                      {selectedTasks.map((task) => (
                        <SortableSelectedTaskRow
                          key={`selected-${task.id}`}
                          task={task}
                          scheduledTime={selectedTaskTimes[task.id] ?? null}
                          onRemove={toggleTaskSelection}
                          onChangeTime={(taskId, nextTime) =>
                            setSelectedTaskTimes((prev) => ({
                              ...prev,
                              [taskId]: nextTime,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
              ) : null}
            </div>
          </div>

        </div>

        <div className="shrink-0 border-t border-base-300/80 bg-base-100 p-2">
          <Button
            variant="primary"
            block
            className="h-10 min-h-10 rounded-xl"
            disabled={!canSave}
            onClick={handleSave}
          >
            {isSaving ? "저장 중..." : "루틴 저장"}
          </Button>
        </div>
      </div>
    </div>
  );
}
