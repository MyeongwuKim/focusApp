import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
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
  });
};

const invalidateRoutineTemplateWeekdayAssignments = async (
  queryClient: ReturnType<typeof useQueryClient>
) => {
  await queryClient.invalidateQueries({
    queryKey: routineTemplateWeekdayAssignmentsQueryKey,
  });
};

export function useRoutineTemplateMutation() {
  const queryClient = useQueryClient();

  const createRoutineTemplateMutation = useMutation({
    mutationFn: (input: { name: string; items: RoutineTemplateItemInput[] }) =>
      createRoutineTemplate(input),
    onSuccess: async () => {
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
    onSuccess: async () => {
      await invalidateRoutineTemplates(queryClient);
      await invalidateRoutineTemplateWeekdayAssignments(queryClient);
    },
  });

  const deleteRoutineTemplateMutation = useMutation({
    mutationFn: (input: { routineTemplateId: string }) => deleteRoutineTemplate(input),
    onSuccess: async () => {
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
