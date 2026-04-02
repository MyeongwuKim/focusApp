import { useMutation, useQueryClient } from "@tanstack/react-query";
import { addTask, addTaskCollection, deleteTask, deleteTaskCollection } from "../api/taskApi";
import { taskCollectionsQueryKey } from "./useTaskCollectionsQuery";
import type { AddTaskInput, CreateTaskCollectionInput } from "../graphql/generated";

const invalidateTaskCollections = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({
    queryKey: taskCollectionsQueryKey
  });
};

export default function useTaskCollectionMutation() {
  const queryClient = useQueryClient();

  const createTaskCollectionMutation = useMutation({
    mutationFn: (input: CreateTaskCollectionInput) => addTaskCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    }
  });

  const addTaskMutation = useMutation({
    mutationFn: (input: AddTaskInput) => addTask(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (input: { taskId: string }) => deleteTask(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    }
  });

  const deleteTaskCollectionMutation = useMutation({
    mutationFn: (input: { collectionId: string }) => deleteTaskCollection(input),
    onSuccess: async () => {
      await invalidateTaskCollections(queryClient);
    }
  });

  return {
    createTaskCollectionMutation,
    addTaskMutation,
    deleteTaskMutation,
    deleteTaskCollectionMutation
  };
}
