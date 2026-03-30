import { useEffect, useState } from "react";
import { TaskManagementActions } from "../features/task-management/components/TaskManagementActions";
import {
  type ManagedCollection,
  TaskManagementBody,
  type ManagedTaskItem,
} from "../features/task-management/components/TaskManagementBody";
import { TaskManagementFooter } from "../features/task-management/components/TaskManagementFooter";
import {
  TaskManagementModalProvider,
  useTaskManagementModals,
} from "../features/task-management/providers/TaskManagementModalProvider";
import { toast, useAppStore } from "../stores";

const TASKS_STORAGE_KEY = "focus-hybrid:managed-task-items";
const COLLECTIONS_STORAGE_KEY = "focus-hybrid:managed-task-collections";
const RECENT_DATE_STORAGE_KEY = "focus-hybrid:managed-task-recent-date";
const DEFAULT_COLLECTION_ID = "collection-default";

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function buildCollection(name: string): ManagedCollection {
  return {
    id: `collection-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
  };
}

function buildTaskItem(label: string, collectionId: string): ManagedTaskItem {
  return {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label,
    collectionId,
  };
}

function TaskManagementRouteContent() {
  const { openCreateCollection, openCreateTask, openRename } = useTaskManagementModals();
  const selectedDateKey = useAppStore((state) => state.selectedDateKey);
  const [tasks, setTasks] = useState<ManagedTaskItem[]>([]);
  const [collections, setCollections] = useState<ManagedCollection[]>([
    { id: DEFAULT_COLLECTION_ID, name: "기본" },
  ]);
  const [recentAddedDateKey, setRecentAddedDateKey] = useState<string | null>(null);

  useEffect(() => {
    const storedCollectionsRaw = window.localStorage.getItem(COLLECTIONS_STORAGE_KEY);
    if (storedCollectionsRaw) {
      try {
        const parsed = JSON.parse(storedCollectionsRaw) as ManagedCollection[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCollections(parsed);
        }
      } catch (error) {
        console.warn("Failed to parse managed collections", error);
      }
    }

    const storedTasksRaw = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (storedTasksRaw) {
      try {
        const parsed = JSON.parse(storedTasksRaw) as ManagedTaskItem[];
        if (Array.isArray(parsed)) {
          setTasks(parsed);
        }
      } catch (error) {
        console.warn("Failed to parse managed tasks", error);
      }
    }

    const storedDate = window.localStorage.getItem(RECENT_DATE_STORAGE_KEY);
    if (storedDate) {
      setRecentAddedDateKey(storedDate);
    }
  }, []);

  const handleCreateCollection = (name: string) => {
    setCollections((prev) => {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return prev;
      }
      const duplicated = prev.some((collection) => collection.name === trimmedName);
      if (duplicated) {
        toast.error("이미 같은 이름의 컬렉션이 있어요.", "중복 컬렉션");
        return prev;
      }

      const next = [...prev, buildCollection(trimmedName)];
      window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleRemoveTask = (taskId: string) => {
    setTasks((prev) => {
      const next = prev.filter((task) => task.id !== taskId);
      window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const handleRequestRenameTask = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) {
      return;
    }
    void (async () => {
      const nextName = await openRename({
        title: "할일 이름 변경",
        initialValue: target.label,
        placeholder: "할일 이름",
      });
      if (!nextName) {
        return;
      }
      handleRename({ type: "task", id: target.id }, nextName);
    })();
  };

  const handleRequestDeleteTask = (taskId: string) => {
    handleRemoveTask(taskId);
    toast.positive("할일이 삭제되었습니다.", "삭제됨");
  };

  const handleRequestRenameCollection = (collectionId: string) => {
    const target = collections.find((collection) => collection.id === collectionId);
    if (!target) {
      return;
    }
    void (async () => {
      const nextName = await openRename({
        title: "컬렉션 이름 변경",
        initialValue: target.name,
        placeholder: "컬렉션 이름",
      });
      if (!nextName) {
        return;
      }
      handleRename({ type: "collection", id: target.id }, nextName);
    })();
  };

  const handleRequestDeleteCollection = (collectionId: string) => {
    setCollections((prev) => {
      const next = prev.filter((collection) => collection.id !== collectionId);
      window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    setTasks((prev) => {
      const next = prev.map((task) =>
        task.collectionId === collectionId ? { ...task, collectionId: DEFAULT_COLLECTION_ID } : task
      );
      window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    toast.positive("컬렉션을 삭제하고 할일을 기본으로 이동했어요.", "삭제됨");
  };

  const handleCreateTask = (input: { label: string; collectionId: string }) => {
    const trimmedLabel = input.label.trim();
    if (!trimmedLabel) {
      return;
    }

    setTasks((prev) => {
      const duplicated = prev.some(
        (task) => task.label === trimmedLabel && task.collectionId === input.collectionId
      );
      if (duplicated) {
        toast.error("같은 컬렉션에 같은 할일이 이미 있어요.", "중복 할일");
        return prev;
      }

      const next = [...prev, buildTaskItem(trimmedLabel, input.collectionId)];
      window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });

    const dateKey = selectedDateKey ?? getTodayDateKey();
    setRecentAddedDateKey(dateKey);
    window.localStorage.setItem(RECENT_DATE_STORAGE_KEY, dateKey);
  };

  const handleRename = (
    target: { type: "task"; id: string } | { type: "collection"; id: string },
    nextName: string
  ) => {
    if (target.type === "task") {
      const targetTask = tasks.find((task) => task.id === target.id);
      if (!targetTask) {
        return;
      }

      const duplicated = tasks.some(
        (task) =>
          task.id !== target.id &&
          task.collectionId === targetTask.collectionId &&
          task.label === nextName
      );
      if (duplicated) {
        toast.error("같은 컬렉션에 같은 이름의 할일이 있어요.", "중복 할일");
        return;
      }

      setTasks((prev) => {
        const next = prev.map((task) =>
          task.id === target.id ? { ...task, label: nextName } : task
        );
        window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      toast.positive("할일 이름이 변경되었습니다.", "변경됨");
      return;
    }

    const duplicatedCollection = collections.some(
      (collection) => collection.id !== target.id && collection.name === nextName
    );
    if (duplicatedCollection) {
      toast.error("같은 이름의 컬렉션이 있어요.", "중복 컬렉션");
      return;
    }

    setCollections((prev) => {
      const next = prev.map((collection) =>
        collection.id === target.id ? { ...collection, name: nextName } : collection
      );
      window.localStorage.setItem(COLLECTIONS_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    toast.positive("컬렉션 이름이 변경되었습니다.", "변경됨");
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <TaskManagementBody
        tasks={tasks}
        collections={collections}
        onRequestRenameTask={handleRequestRenameTask}
        onRequestDeleteTask={handleRequestDeleteTask}
        onRequestRenameCollection={handleRequestRenameCollection}
        onRequestDeleteCollection={handleRequestDeleteCollection}
      />

      <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
        <TaskManagementActions
          onOpenCollection={() => {
            void (async () => {
              const name = await openCreateCollection();
              if (!name) {
                return;
              }
              handleCreateCollection(name);
            })();
          }}
          onOpenTaskPicker={() => {
            void (async () => {
              const taskInput = await openCreateTask(collections);
              if (!taskInput) {
                return;
              }
              handleCreateTask(taskInput);
            })();
          }}
        />
        <TaskManagementFooter recentAddedDateKey={recentAddedDateKey} />
      </div>
    </section>
  );
}

export function TaskManagementRoutePage() {
  return (
    <TaskManagementModalProvider>
      <TaskManagementRouteContent />
    </TaskManagementModalProvider>
  );
}
