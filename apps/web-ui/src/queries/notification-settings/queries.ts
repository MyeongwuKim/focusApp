import { useQuery } from "@tanstack/react-query";
import { fetchNotificationSettings } from "../../api/notificationSettingsApi";

export const notificationSettingsQueryKey = ["notificationSettings"] as const;

export function notificationSettingsQuery() {
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
  const settings = notificationSettingsQuery();

  return {
    notificationSettingsQuery: settings,
  };
}
