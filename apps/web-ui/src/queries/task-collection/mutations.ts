import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  acceptTaskSuggestion,
  addTask,
  addTaskCollection,
  deleteTask,
  deleteTaskCollection,
  dismissTaskSuggestion,
  moveTaskToCollection,
  renameTask,
  renameTaskCollection,
  reorderTaskCollections,
  reorderTasks,
  recordTaskSuggestionUsage,
  setTaskFavorite,
} from "../../api/taskApi";
import { taskCollectionsQueryKey } from "./queries";
import type { AddTaskInput, CreateTaskCollectionInput } from "../../graphql/generated";

const invalidateTaskCollections = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({
    queryKey: taskCollectionsQueryKey,
  });
};

export function useTaskCollectionMutation() {
  const queryClient = useQueryClient();

  const createTaskCollectionMutation = useMutation({
    mutationFn: (input: CreateTaskCollectionInput) => addTaskCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const addTaskMutation = useMutation({
    mutationFn: (input: AddTaskInput) => addTask(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (input: { taskId: string }) => deleteTask(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const moveTaskToCollectionMutation = useMutation({
    mutationFn: (input: { taskId: string; collectionId: string }) => moveTaskToCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const deleteTaskCollectionMutation = useMutation({
    mutationFn: (input: { collectionId: string }) => deleteTaskCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const reorderTaskCollectionsMutation = useMutation({
    mutationFn: (input: { collectionIds: string[] }) => reorderTaskCollections(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const reorderTasksMutation = useMutation({
    mutationFn: (input: { taskIds: string[] }) => reorderTasks(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const renameTaskMutation = useMutation({
    mutationFn: (input: { taskId: string; title: string }) => renameTask(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const renameTaskCollectionMutation = useMutation({
    mutationFn: (input: { collectionId: string; name: string }) => renameTaskCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  const setTaskFavoriteMutation = useMutation({
    mutationFn: (input: { taskId: string; isFavorite: boolean }) => setTaskFavorite(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  return {
    createTaskCollectionMutation,
    addTaskMutation,
    deleteTaskMutation,
    moveTaskToCollectionMutation,
    deleteTaskCollectionMutation,
    reorderTaskCollectionsMutation,
    reorderTasksMutation,
    renameTaskMutation,
    renameTaskCollectionMutation,
    setTaskFavoriteMutation,
  };
}

/** 반복 입력 집계와 저장 제안 수락·거절만 제공해 일일 할 일 화면이 관리 페이지용 mutation을 만들지 않게 한다. */
export function useTaskSuggestionMutation() {
  const queryClient = useQueryClient();
  const recordTaskSuggestionUsageMutation = useMutation({
    mutationFn: recordTaskSuggestionUsage,
  });
  const dismissTaskSuggestionMutation = useMutation({
    mutationFn: dismissTaskSuggestion,
  });
  const acceptTaskSuggestionMutation = useMutation({
    mutationFn: acceptTaskSuggestion,
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    },
  });

  return {
    recordTaskSuggestionUsageMutation,
    dismissTaskSuggestionMutation,
    acceptTaskSuggestionMutation,
  };
}
