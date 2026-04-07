import { useEffect, useMemo, useState } from "react";
import { FiPlus, FiX } from "react-icons/fi";
import { useTaskCollectionQuery } from "../../../queries";
import { TaskManagementTaskItem } from "../../task-management/components/TaskManagementTaskItem";
import { TaskManagementCollectionItem } from "../../task-management/components/TaskManagementCollectionItem";

type PickerCategory = "all" | string;

type PickerTask = {
  id: string;
  label: string;
  collectionId: string;
};

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
  const [favoriteTaskIds, setFavoriteTaskIds] = useState<string[]>([]);
  const [customLabel, setCustomLabel] = useState("");

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
          }))
      ),
    [collections]
  );

  const visibleTasks = useMemo(() => {
    const base =
      selectedCategory === "all"
        ? taskLibrary
        : taskLibrary.filter((task) => task.collectionId === selectedCategory);

    return [...base].sort((a, b) => {
      const aFavorite = favoriteTaskIds.includes(a.id);
      const bFavorite = favoriteTaskIds.includes(b.id);
      if (aFavorite === bFavorite) {
        return a.label.localeCompare(b.label, "ko");
      }
      return aFavorite ? -1 : 1;
    });
  }, [favoriteTaskIds, selectedCategory, taskLibrary]);

  const collectionCountMap = useMemo(() => {
    const counts = new Map<string, number>();
    for (const task of taskLibrary) {
      counts.set(task.collectionId, (counts.get(task.collectionId) ?? 0) + 1);
    }
    return counts;
  }, [taskLibrary]);

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

  const toggleCustomSelection = (label: string) => {
    const normalized = label.trim();
    if (!normalized) {
      return;
    }
    const nextKey = `custom:${normalized.toLowerCase()}`;
    setSelectedItems((prev) => {
      const exists = prev.some((item) => item.key === nextKey);
      if (exists) {
        return prev.filter((item) => item.key !== nextKey);
      }
      return [...prev, { key: nextKey, label: normalized }];
    });
  };

  const addCustomTask = () => {
    const nextLabel = customLabel.trim();
    if (!nextLabel) {
      return;
    }
    toggleCustomSelection(nextLabel);
    setCustomLabel("");
  };

  const toggleFavoriteTask = (taskId: string) => {
    setFavoriteTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
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
        <button
          type="button"
          aria-label="할일 선택 닫기"
          className="btn btn-sm btn-ghost btn-circle"
          onClick={onClose}
        >
          <FiX size={18} />
        </button>
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
                      active: favoriteTaskIds.includes(task.id),
                      ariaLabel: favoriteTaskIds.includes(task.id) ? "즐겨찾기 해제" : "즐겨찾기",
                      onClick: () => toggleFavoriteTask(task.id),
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
                <button
                  key={item.key}
                  type="button"
                  className="rounded-full border border-primary/35 bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  onClick={() =>
                    item.taskId
                      ? toggleTaskSelection({
                          id: item.taskId,
                          label: item.label,
                          collectionId: "all",
                        })
                      : toggleCustomSelection(item.label)
                  }
                >
                  {item.label}
                </button>
              ))
            ) : (
              <p className="m-0 text-xs text-base-content/55">아직 선택된 할일이 없어요.</p>
            )}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-[1fr_96px] gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-base-300/75 bg-base-100/90 px-3">
            <input
              value={customLabel}
              onChange={(event) => setCustomLabel(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  addCustomTask();
                }
              }}
              className="h-9 w-full bg-transparent text-sm outline-none"
              placeholder="리스트에 없는 할일 직접 추가"
            />
            <button
              type="button"
              className="btn btn-xs btn-ghost btn-circle"
              onClick={addCustomTask}
              aria-label="직접 할일 추가"
            >
              <FiPlus size={14} />
            </button>
          </div>
          <button
            type="button"
            className="btn btn-primary h-9 min-h-9 rounded-full text-xs"
            disabled={selectedItems.length === 0}
            onClick={handleApply}
          >
            {selectedItems.length}개 추가
          </button>
        </div>
        </div>
      </div>
    </div>
  );
}
