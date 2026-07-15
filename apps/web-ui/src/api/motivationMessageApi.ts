import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getApiOrigin } from "./graphqlEndpoint";

export type MotivationMessageResponse = {
  message: string;
  ttlSeconds: number;
};

export type FetchMotivationMessageInput = {
  dateKey?: string | null;
};

export async function fetchMotivationMessage(input: FetchMotivationMessageInput = {}) {
  const apiOrigin = getApiOrigin();
  const params = new URLSearchParams();
  if (input.dateKey) {
    params.set("dateKey", input.dateKey);
  }

  const queryString = params.toString();
  const path = `/api/motivation/message${queryString ? `?${queryString}` : ""}`;
  const endpoint = apiOrigin ? `${apiOrigin}${path}` : path;
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
