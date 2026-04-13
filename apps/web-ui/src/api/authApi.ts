import { useAuthStore } from "../stores";
import { getApiOrigin } from "./graphqlEndpoint";

export async function logout() {
  const token = useAuthStore.getState().token;
  const apiOrigin = getApiOrigin() || "http://localhost:4000";

  if (token) {
    await fetch(`${apiOrigin}/auth/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }

  useAuthStore.getState().clearAuth();
}
