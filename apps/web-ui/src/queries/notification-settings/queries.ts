import { useQuery } from "@tanstack/react-query";
import { fetchNotificationSettings } from "../../api/notificationSettingsApi";

export const notificationSettingsQueryKey = ["notificationSettings"] as const;

function useNotificationSettingsQueryInternal() {
  return useQuery({
    queryKey: notificationSettingsQueryKey,
    queryFn: () => fetchNotificationSettings(),
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useNotificationSettingsQuery() {
  const settings = useNotificationSettingsQueryInternal();

  return {
    notificationSettingsQuery: settings,
  };
}
