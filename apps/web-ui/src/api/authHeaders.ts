import { useAuthStore } from "../stores";

export function buildAuthHeaders() {
  const token = useAuthStore.getState().token;

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}
