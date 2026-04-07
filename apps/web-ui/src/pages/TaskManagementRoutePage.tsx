import { useEffect, useMemo, useReducer } from "react";
import { TaskManagementActions } from "../features/task-management/components/TaskManagementActions";
import { TaskManagementBody } from "../features/task-management/components/TaskManagementBody";
import { TaskManagementFooter } from "../features/task-management/components/TaskManagementFooter";
import { TaskManagementModalProvider } from "../features/task-management/providers/TaskManagementModalProvider";
import { TaskManagementContextProvider } from "../features/task-management/providers/TaskManagementContextProvider";
import {
  createInitialTaskManagementDataState,
  reorderById,
  taskManagementDataReducer,
} from "../features/task-management/state/taskManagementDataReducer";
import { useTaskCollectionMutation, useTaskCollectionQuery } from "../queries";
import { toast } from "../stores";

const DEFAULT_COLLECTION_ID = "collection-default";

function TaskManagementRouteContent() {
  const [state, dispatch] = useReducer(
    taskManagementDataReducer,
    createInitialTaskManagementDataState(DEFAULT_COLLECTION_ID)
  );
  const { tasks, collections, selectedCollectionId, selectedTaskId } = state;

  const {
    addTaskMutation,
    createTaskCollectionMutation,
    deleteTaskCollectionMutation,
    deleteTaskMutation,
    moveTaskToCollectionMutation,
    renameTaskCollectionMutation,
    renameTaskMutation,
    reorderTaskCollectionsMutation,
    reorderTasksMutation,
  } = useTaskCollectionMutation();

  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const { data } = taskCollectionsQuery;

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
      dispatch({
        type: "APPEND_COLLECTION",
        payload: { id: created.id, name: created.name },
      });
      toast.positive("컬렉션이 추가되었습니다.", "추가됨");
    } catch (error) {
      const message = error instanceof Error ? error.message : "컬렉션 추가 중 오류가 발생했어요.";
      toast.error(message, "추가 실패");
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      await deleteTaskMutation.mutateAsync({ taskId });
      if (selectedTaskId === taskId) {
        dispatch({ type: "SELECT_TASK", payload: null });
      }
      toast.positive("할일이 삭제되었습니다.", "삭제됨");
    } catch (error) {
      const message = error instanceof Error ? error.message : "할일 삭제 중 오류가 발생했어요.";
      toast.error(message, "삭제 실패");
    }
  };

  const handleDeleteCollection = async (collectionId: string) => {
    try {
      await deleteTaskCollectionMutation.mutateAsync({ collectionId });
      if (selectedCollectionId === collectionId) {
        dispatch({ type: "SELECT_COLLECTION", payload: "all" });
      }
      toast.positive("컬렉션이 삭제되었습니다.", "삭제됨");
    } catch (error) {
      const message = error instanceof Error ? error.message : "컬렉션 삭제 중 오류가 발생했어요.";
      toast.error(message, "삭제 실패");
    }
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

  const handleMoveTaskToCollection = (taskId: string, collectionId: string) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask || targetTask.collectionId === collectionId) {
      return;
    }

    const duplicated = tasks.some(
      (task) =>
        task.id !== taskId &&
        task.collectionId === collectionId &&
        task.label.trim().toLowerCase() === targetTask.label.trim().toLowerCase()
    );
    if (duplicated) {
      toast.error("같은 컬렉션에 같은 이름의 할일이 있어요.", "이동 실패");
      return;
    }

    const previousCollectionId = targetTask.collectionId;
    dispatch({
      type: "MOVE_TASK_TO_COLLECTION",
      payload: { taskId, collectionId },
    });

    void (async () => {
      try {
        await moveTaskToCollectionMutation.mutateAsync({ taskId, collectionId });
      } catch (error) {
        dispatch({
          type: "MOVE_TASK_TO_COLLECTION",
          payload: { taskId, collectionId: previousCollectionId },
        });
        const message = error instanceof Error ? error.message : "할일 이동 중 오류가 발생했어요.";
        toast.error(message, "이동 실패");
      }
    })();
  };

  const handleReorderVisibleTasks = (activeTaskId: string, overTaskId: string) => {
    if (activeTaskId === overTaskId) {
      return;
    }

    const nextTasks = reorderById(tasks, activeTaskId, overTaskId);
    if (!nextTasks) {
      return;
    }

    const previousTasks = tasks;
    dispatch({ type: "REPLACE_TASKS", payload: nextTasks });

    void (async () => {
      try {
        await reorderTasksMutation.mutateAsync({
          taskIds: nextTasks.map((task) => task.id),
        });
      } catch (error) {
        dispatch({ type: "REPLACE_TASKS", payload: previousTasks });
        const message = error instanceof Error ? error.message : "할일 순서 변경 중 오류가 발생했어요.";
        toast.error(message, "순서 변경 실패");
      }
    })();
  };

  const handleReorderCollections = (activeCollectionId: string, overCollectionId: string) => {
    if (activeCollectionId === overCollectionId) {
      return;
    }

    const nextCollections = reorderById(collections, activeCollectionId, overCollectionId);
    if (!nextCollections) {
      return;
    }

    const previousCollections = collections;
    dispatch({ type: "REPLACE_COLLECTIONS", payload: nextCollections });

    void (async () => {
      try {
        await reorderTaskCollectionsMutation.mutateAsync({
          collectionIds: nextCollections.map((collection) => collection.id),
        });
      } catch (error) {
        dispatch({ type: "REPLACE_COLLECTIONS", payload: previousCollections });
        const message = error instanceof Error ? error.message : "컬렉션 순서 변경 중 오류가 발생했어요.";
        toast.error(message, "순서 변경 실패");
      }
    })();
  };

  const handleRenameTask = (taskId: string, nextName: string) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    if (targetTask.label === trimmedName) {
      return;
    }

    const duplicated = tasks.some(
      (task) =>
        task.id !== taskId &&
        task.collectionId === targetTask.collectionId &&
        task.label.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (duplicated) {
      toast.error("같은 컬렉션에 같은 이름의 할일이 있어요.", "중복 할일");
      return;
    }

    dispatch({
      type: "RENAME_TASK",
      payload: { taskId, label: trimmedName },
    });

    void (async () => {
      try {
        await renameTaskMutation.mutateAsync({
          taskId,
          title: trimmedName,
        });
        toast.positive("할일 이름이 변경되었습니다.", "변경됨");
      } catch (error) {
        dispatch({
          type: "RENAME_TASK",
          payload: { taskId, label: targetTask.label },
        });
        const message = error instanceof Error ? error.message : "할일 이름 변경 중 오류가 발생했어요.";
        toast.error(message, "변경 실패");
      }
    })();
  };

  const handleRenameCollection = (collectionId: string, nextName: string) => {
    const targetCollection = collections.find((collection) => collection.id === collectionId);
    if (!targetCollection) {
      return;
    }

    const trimmedName = nextName.trim();
    if (!trimmedName) {
      return;
    }

    if (targetCollection.name === trimmedName) {
      return;
    }

    const duplicatedCollection = collections.some(
      (collection) => collection.id !== collectionId && collection.name.trim() === trimmedName
    );
    if (duplicatedCollection) {
      toast.error("같은 이름의 컬렉션이 있어요.", "중복 컬렉션");
      return;
    }

    dispatch({
      type: "RENAME_COLLECTION",
      payload: { collectionId, name: trimmedName },
    });

    void (async () => {
      try {
        await renameTaskCollectionMutation.mutateAsync({
          collectionId,
          name: trimmedName,
        });
        toast.positive("컬렉션 이름이 변경되었습니다.", "변경됨");
      } catch (error) {
        dispatch({
          type: "RENAME_COLLECTION",
          payload: { collectionId, name: targetCollection.name },
        });
        const message = error instanceof Error ? error.message : "컬렉션 이름 변경 중 오류가 발생했어요.";
        toast.error(message, "변경 실패");
      }
    })();
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

    dispatch({
      type: "HYDRATE_FROM_QUERY",
      payload: {
        collections: mappedCollections,
        tasks: mappedTasks,
      },
    });
  }, [data]);

  useEffect(() => {
    dispatch({ type: "CLEAR_SELECTED_TASK_IF_MISSING" });
  }, [tasks, dispatch]);

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-base-300 bg-base-200/40 p-4">
      <TaskManagementContextProvider
        data={{
          tasks,
          collections,
          selectedCollectionId,
          selectedTaskId,
        }}
        meta={{
          selectedTaskLabel,
          selectedTaskLastUsedAt,
          recentUsedAt,
        }}
        actions={{
          onSelectCollection: (collectionId) =>
            dispatch({ type: "SELECT_COLLECTION", payload: collectionId }),
          onSelectTask: (taskId) => dispatch({ type: "SELECT_TASK", payload: taskId }),
          onRenameTask: handleRenameTask,
          onDeleteTask: handleDeleteTask,
          onRenameCollection: handleRenameCollection,
          onDeleteCollection: handleDeleteCollection,
          onMoveTaskToCollection: handleMoveTaskToCollection,
          onReorderVisibleTasks: handleReorderVisibleTasks,
          onReorderCollections: handleReorderCollections,
          onCreateCollection: handleCreateCollection,
          onCreateTask: handleCreateTask,
        }}
      >
        <TaskManagementBody />

        <div className="mt-3 shrink-0 space-y-2 border-t border-base-300/65 pt-2.5">
          <TaskManagementActions />
          <TaskManagementFooter />
        </div>
      </TaskManagementContextProvider>
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
