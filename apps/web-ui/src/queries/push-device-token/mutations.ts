import { useMutation } from "@tanstack/react-query";
import {
  registerPushDeviceToken,
  type RegisterPushDeviceTokenInput,
} from "../../api/pushDeviceTokenApi";

export function usePushDeviceTokenMutation() {
  const registerPushDeviceTokenMutation = useMutation({
    mutationFn: (input: RegisterPushDeviceTokenInput) => registerPushDeviceToken(input),
  });

  return {
    registerPushDeviceTokenMutation,
  };
}
