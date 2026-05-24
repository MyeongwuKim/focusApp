import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchTaskCollections } from "../../api/taskApi";

export const taskCollectionsQueryKey = ["taskCollections"] as const;

type TaskCollectionsQueryOptions = {
  enabled?: boolean;
};

function useTaskCollectionsQuery(options?: TaskCollectionsQueryOptions) {
  return useQuery({
    queryKey: taskCollectionsQueryKey,
    queryFn: () => fetchTaskCollections(),
    enabled: options?.enabled ?? true,
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useTaskCollectionQuery(options?: TaskCollectionsQueryOptions) {
  const taskCollections = useTaskCollectionsQuery(options);

  return {
    taskCollectionsQuery: taskCollections,
  };
}
