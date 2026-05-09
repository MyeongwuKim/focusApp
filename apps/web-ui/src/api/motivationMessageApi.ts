import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getApiOrigin } from "./graphqlEndpoint";

export type MotivationMessageResponse = {
  message: string;
  ttlSeconds: number;
};

export async function fetchMotivationMessage() {
  const apiOrigin = getApiOrigin();
  const endpoint = apiOrigin ? `${apiOrigin}/api/motivation/message` : "/api/motivation/message";
  const response = await fetchWithBackendStatus(endpoint, {
    method: "GET",
    headers: buildAuthHeaders(),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `Motivation message fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as Partial<MotivationMessageResponse>;
  const message = result.message?.trim();
  if (!message) {
    throw new Error("Motivation message is empty");
  }

  return {
    message,
    ttlSeconds: typeof result.ttlSeconds === "number" && result.ttlSeconds > 0 ? result.ttlSeconds : 60 * 60 * 3,
  };
}
