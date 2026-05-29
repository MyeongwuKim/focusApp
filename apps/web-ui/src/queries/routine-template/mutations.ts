import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  type RoutineTemplate,
  updateRoutineTemplate,
  updateRoutineTemplateWeekdayAssignments,
  type RoutineTemplateItemInput,
} from "../../api/routineTemplateApi";
import {
  routineTemplateWeekdayAssignmentsQueryKey,
  routineTemplatesQueryKey,
} from "./queries";

const invalidateRoutineTemplates = async (queryClient: ReturnType<typeof useQueryClient>) => {
  await queryClient.invalidateQueries({
    queryKey: routineTemplatesQueryKey,
    refetchType: "inactive",
  });
};

const invalidateRoutineTemplateWeekdayAssignments = async (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  await queryClient.invalidateQueries({
    queryKey: routineTemplateWeekdayAssignmentsQueryKey,
    refetchType: "inactive",
  });
};

function upsertRoutineTemplateCache(
  previous: RoutineTemplate[] | undefined,
  nextTemplate: RoutineTemplate
) {
  if (!previous || previous.length === 0) {
    return [nextTemplate];
  }
  const targetIndex = previous.findIndex((template) => template.id === nextTemplate.id);
  if (targetIndex < 0) {
    return [...previous, nextTemplate];
  }
  return previous.map((template) => (template.id === nextTemplate.id ? nextTemplate : template));
}

export function useRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  const createRoutineTemplateMutation = useMutation({
    mutationFn: (input: { name: string; items: RoutineTemplateItemInput[] }) =>
      createRoutineTemplate(input),
    onSuccess: async (createdTemplate) => {
      queryClient.setQueryData<RoutineTemplate[] | undefined>(
        routineTemplatesQueryKey,
        (previous) => upsertRoutineTemplateCache(previous, createdTemplate)
      );
      await invalidateRoutineTemplates(queryClient);
      await invalidateRoutineTemplateWeekdayAssignments(queryClient);
    },
  });

  const updateRoutineTemplateMutation = useMutation({
    mutationFn: (input: {
      routineTemplateId: string;
      name?: string;
      items?: RoutineTemplateItemInput[];
    }) => updateRoutineTemplate(input),
    onSuccess: async (updatedTemplate) => {
      queryClient.setQueryData<RoutineTemplate[] | undefined>(
        routineTemplatesQueryKey,
        (previous) => upsertRoutineTemplateCache(previous, updatedTemplate)
      );
      await invalidateRoutineTemplates(queryClient);
      await invalidateRoutineTemplateWeekdayAssignments(queryClient);
    },
  });

  const deleteRoutineTemplateMutation = useMutation({
    mutationFn: (input: { routineTemplateId: string }) => deleteRoutineTemplate(input),
    onSuccess: async (_result, variables) => {
      queryClient.setQueryData<RoutineTemplate[] | undefined>(
        routineTemplatesQueryKey,
        (previous) => previous?.filter((template) => template.id !== variables.routineTemplateId) ?? previous
      );
      await invalidateRoutineTemplates(queryClient);
      await invalidateRoutineTemplateWeekdayAssignments(queryClient);
    },
  });

  const updateRoutineTemplateWeekdayAssignmentsMutation = useMutation({
    mutationFn: (input: {
      assignments: Array<{
        weekday: number;
        routineTemplateId?: string | null;
      }>;
    }) => updateRoutineTemplateWeekdayAssignments(input),
    onSuccess: async () => {
      await invalidateRoutineTemplateWeekdayAssignments(queryClient);
    },
  });

  return {
    createRoutineTemplateMutation,
    updateRoutineTemplateMutation,
    deleteRoutineTemplateMutation,
    updateRoutineTemplateWeekdayAssignmentsMutation,
  };
}
