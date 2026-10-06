import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/ui/Button";
import { useTaskCollectionMutation, useTaskCollectionQuery } from "../../../queries";
import { toast } from "../../../stores";
import { getUserFacingErrorMessage } from "../../../utils/errorMessage";
import { TaskManagementCollectionItem } from "../../task-management/components/TaskManagementCollectionItem";
import { TaskManagementTaskItem } from "../../task-management/components/TaskManagementTaskItem";

type PickerCategory = "all" | "favorite" | string;

type PickerTask = {
  id: string;
  label: string;
  collectionId: string;
  isFavorite: boolean;
};

type SelectedPickerTask = {
  key: string;
  label: string;
  taskId?: string | null;
};

type TodoTaskPickerModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onApply: (
    items: Array<{
      label: string;
      taskId?: string | null;
    }>
  ) => void | Promise<unknown>;
};

/**
 * 날짜에 할 일을 추가하는 전체 화면이다.
 * 저장한 할 일을 분류별로 살펴보고 여러 개 선택해 현재 날짜에 추가한다.
 */
export function TodoTaskPickerModal({ isOpen, onClose, onApply }: TodoTaskPickerModalProps) {
  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const { setTaskFavoriteMutation } = useTaskCollectionMutation();
  const { data: collections = [], isLoading } = taskCollectionsQuery;
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isVisible, setIsVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PickerCategory>("all");
  const [selectedItems, setSelectedItems] = useState<SelectedPickerTask[]>([]);
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
      if (a.isFavorite === b.isFavorite) {
        return a.label.localeCompare(b.label, "ko");
      }
      return a.isFavorite ? -1 : 1;
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

  const toggleFavoriteTask = (task: PickerTask) => {
    void (async () => {
      try {
        await setTaskFavoriteMutation.mutateAsync({
          taskId: task.id,
          isFavorite: !task.isFavorite,
        });
      } catch (error) {
        const message = getUserFacingErrorMessage(error, "즐겨찾기 저장 중 오류가 발생했어요.");
        toast.show({ type: "error", title: "저장 실패", message, duration: 2200 });
      }
    })();
  };

  const handleLibraryApply = async () => {
    if (selectedItems.length === 0) {
      return;
    }
    await onApply(selectedItems.map((item) => ({ label: item.label, taskId: item.taskId ?? null })));
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
          "todo-add-sheet saved-task-picker absolute inset-0 flex flex-col bg-transparent transition-[transform,opacity] duration-250 ease-out",
          isVisible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-90",
        ].join(" ")}
      >
        <>
            <div className="grid min-h-0 flex-1 grid-cols-[1fr_104px] gap-2 px-2 pb-2">
              <div className="saved-task-picker__tasks min-h-0 rounded-xl border border-base-300/80 bg-base-200/35 p-2">
                <div className="no-scrollbar h-full space-y-1.5 overflow-y-auto pr-0.5">
                  {isLoading ? (
                    <p className="m-0 px-1 py-2 text-sm text-base-content/60">컬렉션 불러오는 중...</p>
                  ) : null}
                  {!isLoading && visibleTasks.length === 0 ? (
                    <p className="m-0 px-1 py-2 text-sm text-base-content/60">선택 가능한 할 일이 없어요.</p>
                  ) : null}
                  {visibleTasks.map((task) => {
                    const selected = selectedItems.some((item) => item.key === `task:${task.id}`);
                    const collectionName =
                      categoryItems.find((category) => category.id === task.collectionId)?.label ?? "미분류";
                    return (
                      <TaskManagementTaskItem
                        key={task.id}
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
                    );
                  })}
                </div>
              </div>

              <aside className="saved-task-picker__categories no-scrollbar min-h-0 space-y-1.5 overflow-y-auto rounded-xl border border-base-300/80 bg-base-200/35 p-2">
                {categoryItems.map((category) => {
                  const count =
                    category.id === "all"
                      ? taskLibrary.length
                      : category.id === "favorite"
                        ? favoriteCount
                        : (collectionCountMap.get(category.id) ?? 0);
                  return (
                    <TaskManagementCollectionItem
                      key={category.id}
                      name={category.label}
                      count={count}
                      active={selectedCategory === category.id}
                      onSelect={() => setSelectedCategory(category.id)}
                    />
                  );
                })}
              </aside>
            </div>

            <div className="saved-task-picker__footer shrink-0 space-y-1.5 border-t border-base-300/80 bg-transparent p-2">
              <div className="saved-task-picker__selection flex min-h-20 flex-col rounded-xl border border-base-300/75 bg-base-200/30 px-2.5 py-2">
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
                        onClick={() =>
                          setSelectedItems((prev) => prev.filter((candidate) => candidate.key !== item.key))
                        }
                      >
                        {item.label}
                      </Button>
                    ))
                  ) : (
                    <p className="m-0 text-xs text-base-content/55">아직 선택한 할 일이 없어요.</p>
                  )}
                </div>
              </div>

              <Button
                variant="primary"
                block
                className="h-10 min-h-10 rounded-xl px-3 text-sm font-semibold"
                disabled={selectedItems.length === 0}
                onClick={() => void handleLibraryApply()}
              >
                선택한 할 일 추가
              </Button>
            </div>
        </>
      </div>
    </div>
  );
}
