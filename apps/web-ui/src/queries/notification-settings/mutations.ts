import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  updateNotificationSettings,
  type UpdateNotificationSettingsInput,
} from "../../api/notificationSettingsApi";
import { notificationSettingsQueryKey } from "./queries";

export function useNotificationSettingsMutation() {
  const queryClient = useQueryClient();

  const updateNotificationSettingsMutation = useMutation({
    mutationFn: (input: UpdateNotificationSettingsInput) => updateNotificationSettings(input),
    onSuccess: async (updated) => {
      queryClient.setQueryData(notificationSettingsQueryKey, updated);
    },
  });

  return {
    updateNotificationSettingsMutation,
  };
}
