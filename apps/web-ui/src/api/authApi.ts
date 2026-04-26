import { useAuthStore } from "../stores";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getApiOrigin } from "./graphqlEndpoint";

export async function logout() {
  const token = useAuthStore.getState().token;
  const apiOrigin = getApiOrigin();
  const logoutUrl = apiOrigin ? `${apiOrigin}/auth/logout` : "/auth/logout";

  if (token) {
    await fetchWithBackendStatus(logoutUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    }).catch(() => null);
  }

  useAuthStore.getState().clearAuth();
}
