import { buildAuthHeaders } from "./authHeaders";
import { fetchWithBackendStatus } from "./backendConnectivity";
import { getGraphqlEndpoint } from "./graphqlEndpoint";
import type { GraphQLResponse } from "./graphqlResponse";

export type AchievementProgressRecord = {
  id: string;
  badgeId: string;
  title: string;
  description: string;
  icon: string;
  category: "focus" | "done" | "streak" | "weekly";
  scope: "total" | "streak" | "weekly";
  tier: "bronze" | "silver" | "gold" | "platinum" | "ruby" | "diamond";
  goal: number;
  currentValue: number;
  isAchieved: boolean;
  achievedCount: number;
  lastAchievedAt: string | null;
  lastAchievedWeekKey: string | null;
  weeklyStreak: number;
  bestWeeklyStreak: number;
  updatedAt: string;
};

export type AchievementEventRecord = {
  id: string;
  badgeId: string;
  title: string;
  description: string;
  icon: string;
  category: "focus" | "done" | "streak" | "weekly";
  scope: "total" | "streak" | "weekly";
  tier: "bronze" | "silver" | "gold" | "platinum" | "ruby" | "diamond";
  goal: number;
  currentValue: number;
  cycleIndex: number;
  weekKey: string | null;
  weeklyStreak: number | null;
  achievedAt: string;
};

type SyncAchievementPayload = {
  progressCount: number;
  newEventCount: number;
  syncedAt: string;
};

const ACHIEVEMENT_PROGRESS_QUERY = /* GraphQL */ `
  query AchievementProgressList {
    achievementProgressList {
      id
      badgeId
      title
      description
      icon
      category
      scope
      tier
      goal
      currentValue
      isAchieved
      achievedCount
      lastAchievedAt
      lastAchievedWeekKey
      weeklyStreak
      bestWeeklyStreak
      updatedAt
    }
  }
`;

const ACHIEVEMENT_HISTORY_QUERY = /* GraphQL */ `
  query AchievementHistory($limit: Int, $offset: Int) {
    achievementHistory(limit: $limit, offset: $offset) {
      id
      badgeId
      title
      description
      icon
      category
      scope
      tier
      goal
      currentValue
      cycleIndex
      weekKey
      weeklyStreak
      achievedAt
    }
  }
`;

const SYNC_ACHIEVEMENTS_MUTATION = /* GraphQL */ `
  mutation SyncAchievements {
    syncAchievements {
      progressCount
      newEventCount
      syncedAt
    }
  }
`;

type AchievementProgressQueryPayload = {
  achievementProgressList: AchievementProgressRecord[];
};

type AchievementHistoryQueryPayload = {
  achievementHistory: AchievementEventRecord[];
};

type SyncAchievementsMutationPayload = {
  syncAchievements: SyncAchievementPayload;
};

export async function fetchAchievementProgressList() {
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: ACHIEVEMENT_PROGRESS_QUERY,
    }),
  });

  if (!response.ok) {
    throw new Error(`Achievement progress fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<AchievementProgressQueryPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL achievementProgressList failed");
  }

  return result.data?.achievementProgressList ?? [];
}

export async function fetchAchievementHistory(input?: { limit?: number; offset?: number }) {
  const limit = Math.max(input?.limit ?? 100, 1);
  const offset = Math.max(input?.offset ?? 0, 0);
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: ACHIEVEMENT_HISTORY_QUERY,
      variables: { limit, offset },
    }),
  });

  if (!response.ok) {
    throw new Error(`Achievement history fetch failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<AchievementHistoryQueryPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL achievementHistory failed");
  }

  return result.data?.achievementHistory ?? [];
}

export async function syncAchievements() {
  const response = await fetchWithBackendStatus(getGraphqlEndpoint(), {
    method: "POST",
    headers: buildAuthHeaders(),
    body: JSON.stringify({
      query: SYNC_ACHIEVEMENTS_MUTATION,
    }),
  });

  if (!response.ok) {
    throw new Error(`Achievement sync failed: ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<SyncAchievementsMutationPayload>;
  if (result.errors?.length) {
    throw new Error(result.errors[0]?.message ?? "GraphQL syncAchievements failed");
  }

  const payload = result.data?.syncAchievements;
  if (!payload) {
    throw new Error("GraphQL syncAchievements failed");
  }

  return payload;
}
