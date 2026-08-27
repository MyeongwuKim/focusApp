import { useEffect, useMemo, useRef, useState } from "react";
import { FiChevronLeft, FiPlus } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { useTaskCollectionMutation, useTaskCollectionQuery } from "../../../queries";
import { toast } from "../../../stores";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { TaskManagementTaskItem } from "../../task-management/components/TaskManagementTaskItem";
import { TaskManagementCollectionItem } from "../../task-management/components/TaskManagementCollectionItem";
import { TodoCustomTaskModal, type TodoCustomAddMode } from "./TodoCustomTaskModal";

type PickerCategory = "all" | "favorite" | string;

type PickerTask = {
  id: string;
  label: string;
  collectionId: string;
  isFavorite: boolean;
};

const normalizeLabel = (value: string) => value.trim().toLowerCase();

type TodoTaskPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    items: Array<{
      label: string;
      taskId?: string | null;
    }>
  ) => void;
};

export function TodoTaskPickerModal({ isOpen, onClose, onApply }: TodoTaskPickerModalProps) {
  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const { setTaskFavoriteMutation, addTaskMutation } = useTaskCollectionMutation();
  const { data: collections = [], isLoading } = taskCollectionsQuery;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PickerCategory>("all");
  const [selectedItems, setSelectedItems] = useState<
    Array<{
      key: string;
      label: string;
      taskId?: string | null;
    }>
  >([]);
  const [isCustomTaskModalOpen, setIsCustomTaskModalOpen] = useState(false);
  const [isCreatingCustomTask, setIsCreatingCustomTask] = useState(false);
  const customAddLockRef = useRef(false);
  const selectedItemsScrollRef = useRef<HTMLDivElement | null>(null);
  const prevSelectedItemsLengthRef = useRef(0);

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
      setIsCustomTaskModalOpen(false);
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
    const prevLength = prevSelectedItemsLengthRef.current;
    prevSelectedItemsLengthRef.current = selectedItems.length;
    if (selectedItems.length <= prevLength) {
      return;
    }

    const viewport = selectedItemsScrollRef.current;
    if (!viewport) {
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [selectedItems]);

  const categoryItems = useMemo(
    () => [
      { id: "all", label: "전체" },
      { id: "favorite", label: "즐겨찾기" },
      ...collections.map((collection) => ({
        id: collection.id,
        label: collection.name,
      })),
    ],
    [collections]
  );

  const taskLibrary = useMemo<PickerTask[]>(
    () =>
      collections.flatMap((collection) =>
        [...collection.tasks]
          .sort((a, b) => a.order - b.order)
          .map((task) => ({
            id: task.id,
            label: task.title,
            collectionId: collection.id,
            isFavorite: Boolean(task.isFavorite),
          }))
      ),
    [collections]
  );

  const visibleTasks = useMemo(() => {
    const base =
      selectedCategory === "all"
        ? taskLibrary
        : selectedCategory === "favorite"
          ? taskLibrary.filter((task) => task.isFavorite)
          : taskLibrary.filter((task) => task.collectionId === selectedCategory);

    return [...base].sort((a, b) => {
      const aFavorite = a.isFavorite;
      const bFavorite = b.isFavorite;
      if (aFavorite === bFavorite) {
        return a.label.localeCompare(b.label, "ko");
      }
      return aFavorite ? -1 : 1;
    });
  }, [selectedCategory, taskLibrary]);
  const findTaskByLabel = (label: string) =>
    taskLibrary.find((task) => normalizeLabel(task.label) === normalizeLabel(label));

  const collectionCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of taskLibrary) {
      counts.set(task.collectionId, (counts.get(task.collectionId) ?? 0) + 1);
    }
    return counts;
  }, [taskLibrary]);
  const favoriteCount = useMemo(
    () => taskLibrary.filter((task) => task.isFavorite).length,
    [taskLibrary]
  );

  const toggleTaskSelection = (task: PickerTask) => {
    const nextKey = `task:${task.id}`;
    setSelectedItems((prev) => {
      const exists = prev.some((item) => item.key === nextKey);
      if (exists) {
        return prev.filter((item) => item.key !== nextKey);
      }
      return [...prev, { key: nextKey, label: task.label, taskId: task.id }];
    });
  };

  const addSelectedItem = (item: { key: string; label: string; taskId?: string | null }) => {
    const normalizedLabel = normalizeLabel(item.label);
    setSelectedItems((prev) => {
      const exists = prev.some(
        (candidate) =>
          candidate.key === item.key || normalizeLabel(candidate.label) === normalizedLabel
      );
      if (exists) {
        return prev;
      }
      return [...prev, item];
    });
  };
  const hasSelectedLabel = (label: string) =>
    selectedItems.some((candidate) => normalizeLabel(candidate.label) === normalizeLabel(label));
  const tryAddExistingTaskFromLibrary = (label: string): "not_found" | "added" | "duplicate" => {
    const existingTask = findTaskByLabel(label);
    if (!existingTask) {
      return "not_found";
    }

    if (hasSelectedLabel(existingTask.label)) {
      toast.show({
        type: "error",
        title: "중복 항목",
        message: "이미 선택한 항목이에요.",
        duration: 1800,
      });
      return "duplicate";
    }

    addSelectedItem({
      key: `task:${existingTask.id}`,
      label: existingTask.label,
      taskId: existingTask.id,
    });
    toast.show({
      type: "positive",
      title: "기존 할일 사용",
      message: "이미 만든 할일을 선택 목록에 추가했어요.",
      duration: 1800,
    });
    return "added";
  };

  const addCustomTaskTodayOnly = async (label: string) => {
    const nextLabel = label.trim();
    if (!nextLabel || isCreatingCustomTask || customAddLockRef.current) {
      return false;
    }
    const existingTaskResult = tryAddExistingTaskFromLibrary(nextLabel);
    if (existingTaskResult !== "not_found") {
      return existingTaskResult === "added";
    }
    if (hasSelectedLabel(nextLabel)) {
      toast.show({
        type: "error",
        title: "중복 항목",
        message: "이미 선택한 항목이에요.",
        duration: 1800,
      });
      return false;
    }

    customAddLockRef.current = true;
    setIsCreatingCustomTask(true);
    try {
      addSelectedItem({
        key: `custom:${nextLabel.toLowerCase()}`,
        label: nextLabel,
        taskId: null,
      });
      toast.show({
        type: "positive",
        title: "선택 목록에 담음",
        message: "오늘 할일에만 추가할 항목으로 담았어요.",
        duration: 1800,
      });
      return true;
    } finally {
      setIsCreatingCustomTask(false);
      customAddLockRef.current = false;
    }
  };

  const addCustomTaskToCollection = async (label: string, collectionId?: string) => {
    const nextLabel = label.trim();
    const targetCollection = collections.find((collection) => collection.id === collectionId);
    if (!nextLabel || !targetCollection || isCreatingCustomTask || customAddLockRef.current) {
      return false;
    }
    if (hasSelectedLabel(nextLabel)) {
      toast.show({
        type: "error",
        title: "중복 항목",
        message: "이미 선택한 항목이에요.",
        duration: 1800,
      });
      return false;
    }

    customAddLockRef.current = true;
    setIsCreatingCustomTask(true);
    try {
      const existingTask = taskLibrary.find(
        (task) => task.collectionId === targetCollection.id && normalizeLabel(task.label) === normalizeLabel(nextLabel)
      );

      const createdTask = existingTask
        ? null
        : await addTaskMutation.mutateAsync({
            collectionId: targetCollection.id,
            title: nextLabel,
          });
      const nextTaskId = existingTask?.id ?? createdTask?.id;
      const nextTaskLabel = existingTask?.label ?? createdTask?.title ?? nextLabel;
      if (!nextTaskId) {
        throw new Error("할일을 추가하지 못했어요.");
      }

      addSelectedItem({
        key: `task:${nextTaskId}`,
        label: nextTaskLabel,
        taskId: nextTaskId,
      });
      setSelectedCategory(targetCollection.id);
      toast.show({
        type: "positive",
        title: "컬렉션에 저장됨",
        message: existingTask
          ? `${targetCollection.name}에 있던 할일을 선택 목록에 담았어요.`
          : `${targetCollection.name}에 저장하고 선택 목록에 담았어요.`,
        duration: 1800,
      });
      return true;
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "할일 추가 중 오류가 발생했어요.");
      toast.show({
        type: "error",
        title: "추가 실패",
        message,
        duration: 2200,
      });
      return false;
    } finally {
      setIsCreatingCustomTask(false);
      customAddLockRef.current = false;
    }
  };

  const addCustomTask = async (label: string, mode: TodoCustomAddMode, collectionId?: string) => {
    if (mode === "save_collection") {
      return addCustomTaskToCollection(label, collectionId);
    }
    return addCustomTaskTodayOnly(label);
  };

  const toggleFavoriteTask = (task: PickerTask) => {
    void (async () => {
      try {
        await setTaskFavoriteMutation.mutateAsync({
          taskId: task.id,
          isFavorite: !task.isFavorite,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "즐겨찾기 저장 중 오류가 발생했어요.");
        toast.show({
          type: "error",
          title: "저장 실패",
          message,
          duration: 2200,
        });
      }
    })();
  };

  const handleApply = () => {
    if (selectedItems.length === 0) {
      return;
    }
    onApply(selectedItems.map((item) => ({ label: item.label, taskId: item.taskId ?? null })));
    setSelectedItems([]);
    setSelectedCategory("all");
    onClose();
  };

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
        <header className="grid h-12 shrink-0 grid-cols-[44px_1fr_64px] items-center border-b border-base-300/80 px-2">
        <Button variant="ghost" size="sm" circle aria-label="할일 선택 뒤로가기" onClick={onClose}>
          <FiChevronLeft size={18} />
        </Button>
        <h2 className="m-0 text-center text-sm font-semibold text-base-content">할일 가져오기</h2>
        <div aria-hidden="true" />
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[1fr_104px] gap-2 p-2">
        <div className="min-h-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
            {isLoading ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">컬렉션 불러오는 중...</p>
            ) : null}
            {!isLoading && visibleTasks.length === 0 ? (
              <p className="m-0 px-1 py-2 text-sm text-base-content/60">선택 가능한 할일이 없어요.</p>
            ) : null}
            {visibleTasks.map((task) => {
              const selected = selectedItems.some((item) => item.key === `task:${task.id}`);
              const collectionName =
                categoryItems.find((category) => category.id === task.collectionId)?.label ?? "미분류";
              return (
                <div key={task.id}>
                  <TaskManagementTaskItem
                    label={task.label}
                    collectionName={collectionName}
                    active={selected}
                    onSelect={() => toggleTaskSelection(task)}
                    sideButton={{
                      type: "favorite",
                      active: task.isFavorite,
                      ariaLabel: task.isFavorite ? "즐겨찾기 해제" : "즐겨찾기",
                      onClick: () => toggleFavoriteTask(task),
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <aside className="no-scrollbar min-h-0 space-y-1.5 overflow-y-auto rounded-xl border border-base-300/80 bg-base-200/35 p-2">
          {categoryItems.map((category) => {
            const active = selectedCategory === category.id;
            const count =
              category.id === "all"
                ? taskLibrary.length
                : category.id === "favorite"
                  ? favoriteCount
                : (collectionCountMap.get(category.id) ?? 0);
            return (
              <div
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
              >
                <TaskManagementCollectionItem
                  name={category.label}
                  count={count}
                  active={active}
                  onSelect={() => setSelectedCategory(category.id)}
                />
              </div>
            );
          })}
        </aside>
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-base-300/80 bg-base-100 p-2">
        <div className="flex min-h-20 flex-col rounded-xl border border-base-300/75 bg-base-200/30 px-2.5 py-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="m-0 text-xs font-semibold text-base-content/75">선택한 항목</p>
            <button
              type="button"
              className="text-xs text-base-content/55"
              onClick={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              비우기
            </button>
          </div>
          <div
            ref={selectedItemsScrollRef}
            className="no-scrollbar flex min-h-7 flex-1 content-start flex-wrap gap-1 overflow-y-auto"
          >
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => (
                <Button
                  key={item.key}
                  className="h-7 min-h-7 rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  onClick={() => setSelectedItems((prev) => prev.filter((candidate) => candidate.key !== item.key))}
                >
                  {item.label}
                </Button>
              ))
            ) : (
              <p className="m-0 text-xs text-base-content/55">아직 선택한 할일이 없어요.</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            className="h-10 min-h-10 rounded-xl px-3 text-sm font-semibold"
            onClick={() => setIsCustomTaskModalOpen(true)}
          >
            <FiPlus size={16} />
            직접 입력
          </Button>
          <Button
            variant="primary"
            block
            className="h-10 min-h-10 flex-1 rounded-xl px-3 text-sm font-semibold"
            disabled={selectedItems.length === 0}
            onClick={handleApply}
          >
            오늘 할일에 추가
          </Button>
        </div>
        </div>
      </div>

      <TodoCustomTaskModal
        isOpen={isCustomTaskModalOpen}
        isSubmitting={isCreatingCustomTask}
        collections={collections}
        defaultCollectionId={
          collections.some((collection) => collection.id === selectedCategory)
            ? selectedCategory
            : undefined
        }
        onClose={() => setIsCustomTaskModalOpen(false)}
        onSubmit={({ label, mode, collectionId }) => addCustomTask(label, mode, collectionId)}
      />
    </div>
  );
}
