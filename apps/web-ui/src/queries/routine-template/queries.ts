import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchRoutineTemplates } from "../../api/routineTemplateApi";

export const routineTemplatesQueryKey = ["routineTemplates"] as const;

export function routineTemplatesQuery() {
  return useQuery({
    queryKey: routineTemplatesQueryKey,
    queryFn: () => fetchRoutineTemplates(),
    staleTime: 1000 * 60 * 3,
    gcTime: 1000 * 60 * 20,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useRoutineTemplateQuery() {
  const routineTemplates = routineTemplatesQuery();

  return {
    routineTemplatesQuery: routineTemplates,
  };
}
