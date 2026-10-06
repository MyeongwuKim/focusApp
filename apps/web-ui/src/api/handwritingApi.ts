import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getApiOrigin } from "./graphqlEndpoint";

/** 캔버스 이미지를 서버에 전달하고 인식된 할 일 제목 한 줄을 반환한다. */
export async function recognizeHandwriting(imageDataUrl: string) {
  const apiOrigin = getApiOrigin();
  const endpoint = apiOrigin ? `${apiOrigin}/api/handwriting/recognize` : "/api/handwriting/recognize";
  const response = await fetchWithBackendStatus(endpoint, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({ imageDataUrl }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `Handwriting recognition failed: ${response.status}`);
  }

  const result = (await response.json()) as { text?: string };
  const text = result.text?.trim();
  if (!text) {
    throw new Error("손글씨를 읽지 못했어요.");
  }

  return text;
}
