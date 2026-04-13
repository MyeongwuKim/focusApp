import { buildAuthHeaders } from "./authHeaders";
import { getApiOrigin } from "./graphqlEndpoint";

export type StatsCommentaryPayload = {
  period: {
    preset: string;
    start: string;
    end: string;
    days: number;
  };
  totals: {
    doneCount: number;
    incompleteCount: number;
    focusMinutes: number;
    deviationMinutes: number;
    restMinutes: number;
  };
  rates: {
    completionRate: number;
    incompleteRate: number;
  };
  frequentIncompleteTasks: Array<{
    label: string;
    count: number;
  }>;
};

export async function fetchStatsCommentary(payload: StatsCommentaryPayload) {
  const response = await fetch(`${getApiOrigin()}/api/stats/commentary`, {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(errorBody?.message ?? `Stats commentary fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as { commentary?: string };
  const commentary = result.commentary?.trim();
  if (!commentary) {
    throw new Error("Stats commentary is empty");
  }
  return commentary;
}
