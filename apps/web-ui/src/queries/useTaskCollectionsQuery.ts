import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { fetchTaskCollections } from "../api/taskApi";

export const taskCollectionsQueryKey = ["taskCollections"] as const;

export function taskCollectionsQuery() {
  return useQuery({
    queryKey: taskCollectionsQueryKey,
    queryFn: () => fetchTaskCollections(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}
