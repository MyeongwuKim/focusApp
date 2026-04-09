import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  updateRoutineTemplate,
  type RoutineTemplateItemInput,
} from "../../api/routineTemplateApi";
import { routineTemplatesQueryKey } from "./queries";

const invalidateRoutineTemplates = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({
    queryKey: routineTemplatesQueryKey,
  });
};

export function useRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  const createRoutineTemplateMutation = useMutation({
    mutationFn: (input: { name: string; items: RoutineTemplateItemInput[] }) =>
      createRoutineTemplate(input),
    onSuccess: async () => {
      await invalidateRoutineTemplates(queryClient);
    },
  });

  const updateRoutineTemplateMutation = useMutation({
    mutationFn: (input: {
      routineTemplateId: string;
      name?: string;
      items?: RoutineTemplateItemInput[];
    }) => updateRoutineTemplate(input),
    onSuccess: async () => {
      await invalidateRoutineTemplates(queryClient);
    },
  });

  const deleteRoutineTemplateMutation = useMutation({
    mutationFn: (input: { routineTemplateId: string }) => deleteRoutineTemplate(input),
    onSuccess: async () => {
      await invalidateRoutineTemplates(queryClient);
    },
  });

  return {
    createRoutineTemplateMutation,
    updateRoutineTemplateMutation,
    deleteRoutineTemplateMutation,
  };
}
