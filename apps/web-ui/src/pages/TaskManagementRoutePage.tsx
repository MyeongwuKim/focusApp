import { useEffect, useMemo, useState } from "react";
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
import { TaskManagementViewProvider } from "../features/task-management/providers/TaskManagementViewProvider";
import useTaskCollectionMutation from "../queries/useTaskCollectionMutation";
import { toast } from "../stores";
import { taskCollectionsQuery } from "../queries/useTaskCollectionsQuery";

const DEFAULT_COLLECTION_ID = "collection-default";

function TaskManagementRouteContent() {
  const { openCreateCollection, openCreateTask, openRename } = useTaskManagementModals();
  const [tasks, setTasks] = useState<ManagedTaskItem[]>([]);
  const [selectedCollectionId, setSelectedCollectionId] = useState<"all" | string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [collections, setCollections] = useState<ManagedCollection[]>([
    { id: DEFAULT_COLLECTION_ID, name: "기본" },
  ]);

  const { addTaskMutation, createTaskCollectionMutation, deleteTaskCollectionMutation, deleteTaskMutation } =
    useTaskCollectionMutation();

  const { data } = taskCollectionsQuery();

  const recentUsedAt = useMemo(() => {
    if (!data) {
      return null;
    }
    const timestamps = data
      .flatMap((collection) => collection.tasks.map((task) => task.lastUsedAt))
      .filter((value): value is string => Boolean(value))
      .map((value) => new Date(value).getTime())
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return null;
    }
    return new Date(Math.max(...timestamps)).toISOString();
  }, [data]);

  const selectedTaskLabel = useMemo(() => {
    if (!selectedTaskId) {
      return null;
    }
    return tasks.find((task) => task.id === selectedTaskId)?.label ?? null;
  }, [selectedTaskId, tasks]);

  const selectedTaskLastUsedAt = useMemo(() => {
    if (!selectedTaskId || !data) {
      return null;
    }
    for (const collection of data) {
      const matched = collection.tasks.find((task) => task.id === selectedTaskId);
      if (matched) {
        return matched.lastUsedAt ?? null;
      }
    }
    return null;
  }, [selectedTaskId, data]);

  const handleCreateCollection = async (name: string) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      return;
    }

    const duplicated = collections.some((collection) => collection.name === trimmedName);
    if (duplicated) {
      toast.error("이미 같은 이름의 컬렉션이 있어요.", "중복 컬렉션");
      return;
    }

    try {
      const created = await createTaskCollectionMutation.mutateAsync({
        name: trimmedName,
      });
      setCollections((prev) => [...prev, { id: created.id, name: created.name }]);
      toast.positive("컬렉션이 추가되었습니다.", "추가됨");
    } catch (error) {
      const message = error instanceof Error ? error.message : "컬렉션 추가 중 오류가 발생했어요.";
      toast.error(message, "추가 실패");
    }
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
    void (async () => {
      try {
        await deleteTaskMutation.mutateAsync({ taskId });
        if (selectedTaskId === taskId) {
          setSelectedTaskId(null);
        }
        toast.positive("할일이 삭제되었습니다.", "삭제됨");
      } catch (error) {
        const message = error instanceof Error ? error.message : "할일 삭제 중 오류가 발생했어요.";
        toast.error(message, "삭제 실패");
      }
    })();
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
    void (async () => {
      try {
        await deleteTaskCollectionMutation.mutateAsync({ collectionId });
        if (selectedCollectionId === collectionId) {
          setSelectedCollectionId("all");
        }
        toast.positive("컬렉션이 삭제되었습니다.", "삭제됨");
      } catch (error) {
        const message = error instanceof Error ? error.message : "컬렉션 삭제 중 오류가 발생했어요.";
        toast.error(message, "삭제 실패");
      }
    })();
  };

  const handleCreateTask = async (input: { label: string; collectionId: string }) => {
    const trimmedLabel = input.label.trim();
    if (!trimmedLabel) {
      return;
    }

    try {
      await addTaskMutation.mutateAsync({
        collectionId: input.collectionId,
        title: trimmedLabel,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "할일 추가 중 오류가 발생했어요.";
      toast.error(message, "추가 실패");
      return;
    }
    toast.positive("할일이 추가되었습니다.", "추가됨");
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
          task.id !== target.id && task.collectionId === targetTask.collectionId && task.label === nextName
      );
      if (duplicated) {
        toast.error("같은 컬렉션에 같은 이름의 할일이 있어요.", "중복 할일");
        return;
      }

      setTasks((prev) => {
        return prev.map((task) => (task.id === target.id ? { ...task, label: nextName } : task));
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
      return prev.map((collection) =>
        collection.id === target.id ? { ...collection, name: nextName } : collection
      );
    });
    toast.positive("컬렉션 이름이 변경되었습니다.", "변경됨");
  };
  useEffect(() => {
    if (!data) {
      return;
    }

    const mappedCollections = data.map((collection) => ({
      id: collection.id,
      name: collection.name,
    }));
    const mappedTasks = data.flatMap((collection) =>
      collection.tasks.map((task) => ({
        id: task.id,
        label: task.title,
        collectionId: collection.id,
      }))
    );

    setCollections(mappedCollections);
    setTasks(mappedTasks);
  }, [data]);

  useEffect(() => {
    if (!selectedTaskId) {
      return;
    }
    const exists = tasks.some((task) => task.id === selectedTaskId);
    if (!exists) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <TaskManagementViewProvider
        value={{
          tasks,
          collections,
          selectedCollectionId,
          selectedTaskId,
          selectedTaskLabel,
          selectedTaskLastUsedAt,
          recentUsedAt,
          onSelectCollection: (collectionId) => setSelectedCollectionId(collectionId),
          onSelectTask: (taskId) => setSelectedTaskId(taskId),
          onRequestRenameTask: handleRequestRenameTask,
          onRequestDeleteTask: handleRequestDeleteTask,
          onRequestRenameCollection: handleRequestRenameCollection,
          onRequestDeleteCollection: handleRequestDeleteCollection,
          onOpenCollection: () => {
            void (async () => {
              const name = await openCreateCollection();
              if (!name) {
                return;
              }
              await handleCreateCollection(name);
            })();
          },
          onOpenTaskPicker: () => {
            void (async () => {
              const selectedTaskCollectionId = selectedTaskId
                ? tasks.find((task) => task.id === selectedTaskId)?.collectionId
                : undefined;
              const defaultCollectionId =
                selectedCollectionId !== "all" ? selectedCollectionId : selectedTaskCollectionId;
              const taskInput = await openCreateTask(collections, defaultCollectionId);
              if (!taskInput) {
                return;
              }
              await handleCreateTask(taskInput);
            })();
          },
        }}
      >
        <TaskManagementBody />

        <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
          <TaskManagementActions />
          <TaskManagementFooter />
        </div>
      </TaskManagementViewProvider>
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
