import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { Button } from "../../../components/ui/Button";
import { InputField } from "../../../components/ui/InputField";
import { useTaskCollectionMutation, useTaskCollectionQuery } from "../../../queries";
import { toast } from "../../../stores";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { TaskManagementTaskItem } from "../../task-management/components/TaskManagementTaskItem";
import { TaskManagementCollectionItem } from "../../task-management/components/TaskManagementCollectionItem";

type PickerCategory = "all" | "favorite" | string;

type PickerTask = {
  id: string;
  label: string;
  collectionId: string;
  isFavorite: boolean;
};

const UNCATEGORIZED_COLLECTION_NAME = "미분류";

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
  const { setTaskFavoriteMutation, createTaskCollectionMutation, addTaskMutation } = useTaskCollectionMutation();
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
  const [customLabel, setCustomLabel] = useState("");
  const [isCreatingCustomTask, setIsCreatingCustomTask] = useState(false);

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

  const ensureUncategorizedCollectionId = async () => {
    const existing = collections.find(
      (collection) => collection.name.trim() === UNCATEGORIZED_COLLECTION_NAME
    );
    if (existing) {
      return existing.id;
    }

    const created = await createTaskCollectionMutation.mutateAsync({
      name: UNCATEGORIZED_COLLECTION_NAME,
    });
    return created.id;
  };

  const addCustomTask = async () => {
    const nextLabel = customLabel.trim();
    if (!nextLabel || isCreatingCustomTask) {
      return;
    }

    setIsCreatingCustomTask(true);
    try {
      const uncategorizedCollectionId = await ensureUncategorizedCollectionId();
      const existingTask = taskLibrary.find(
        (task) => task.collectionId === uncategorizedCollectionId && task.label.trim() === nextLabel
      );

      const createdTask = existingTask
        ? null
        : await addTaskMutation.mutateAsync({
            collectionId: uncategorizedCollectionId,
            title: nextLabel,
          });
      const nextTaskId = existingTask?.id ?? createdTask?.id;
      const nextTaskLabel = existingTask?.label ?? createdTask?.title ?? nextLabel;
      if (!nextTaskId) {
        throw new Error("할일을 추가하지 못했어요.");
      }

      setSelectedItems((prev) => {
        const key = `task:${nextTaskId}`;
        const exists = prev.some((item) => item.key === key);
        if (exists) {
          return prev;
        }
        return [...prev, { key, label: nextTaskLabel, taskId: nextTaskId }];
      });
      setSelectedCategory(uncategorizedCollectionId);
      setCustomLabel("");
      toast.show({
        type: "positive",
        title: "미분류에 저장됨",
        message: existingTask
          ? "기존 미분류 할일을 선택 목록에 추가했어요."
          : "새 할일을 미분류에 저장하고 선택 목록에 추가했어요.",
        duration: 1800,
      });
    } catch (error) {
      const message = getUserFacingErrorMessage(error, "할일 추가 중 오류가 발생했어요.");
      toast.show({
        type: "error",
        title: "추가 실패",
        message,
        duration: 2200,
      });
    } finally {
      setIsCreatingCustomTask(false);
    }
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
    setCustomLabel("");
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
        <Button variant="ghost" size="sm" circle aria-label="할일 선택 닫기" onClick={onClose}>
          <FiX size={18} />
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

        <aside className="space-y-1.5 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
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

        <div className="shrink-0 border-t border-base-300/80 bg-base-100 p-2">
        <div className="rounded-lg border border-base-300/75 bg-base-200/30 px-2 py-1.5">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="m-0 text-xs font-semibold text-base-content/75">추가한 항목</p>
            <button
              type="button"
              className="text-xs text-base-content/55"
              onClick={() => setSelectedItems([])}
              disabled={selectedItems.length === 0}
            >
              비우기
            </button>
          </div>
          <div className="no-scrollbar flex max-h-16 flex-wrap gap-1 overflow-y-auto">
            {selectedItems.length > 0 ? (
              selectedItems.map((item) => (
                <Button
                  key={item.key}
                  className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  onClick={() =>
                    (() => {
                      const task =
                        taskLibrary.find((candidate) => candidate.id === item.taskId) ?? {
                          id: String(item.taskId),
                          label: item.label,
                          collectionId: "all",
                          isFavorite: false,
                        };
                      toggleTaskSelection(task);
                    })()
                  }
                >
                  {item.label}
                </Button>
              ))
            ) : (
              <p className="m-0 text-xs text-base-content/55">아직 선택된 할일이 없어요.</p>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-base-300/75 bg-base-100/90 px-3">
            <InputField
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addCustomTask();
                }
              }}
              variant="plain"
              className="h-9 w-full bg-transparent text-sm"
              placeholder="리스트에 없는 할일 직접 추가"
            />
            <Button
              variant="ghost"
              size="xs"
              circle
              disabled={isCreatingCustomTask}
              onClick={() => {
                void addCustomTask();
              }}
              aria-label="직접 할일 추가"
            >
              <FiPlus size={14} />
            </Button>
          </div>
          <Button
            variant="primary"
            className="h-9 min-h-9 rounded-full text-xs"
            disabled={selectedItems.length === 0}
            onClick={handleApply}
          >
            {selectedItems.length}개 추가
          </Button>
        </div>
        </div>
      </div>
    </div>
  );
}
