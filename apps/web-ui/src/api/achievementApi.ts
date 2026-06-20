import {
  AchievementHistoryDocument,
  AchievementProgressListDocument,
  SyncAchievementsDocument,
  type AchievementHistoryQuery,
  type AchievementProgressListQuery,
} from "../graphql/generated";
import { requestGraphql } from "./graphqlClient";

type AchievementCategory = "focus" | "done" | "streak" | "weekly";
type AchievementScope = "total" | "streak" | "weekly";
type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "ruby" | "diamond";

export type AchievementProgressRecord = Omit<
  AchievementProgressListQuery["achievementProgressList"][number],
  "category" | "scope" | "tier"
> & {
  category: AchievementCategory;
  scope: AchievementScope;
  tier: AchievementTier;
};

export type AchievementEventRecord = Omit<
  AchievementHistoryQuery["achievementHistory"][number],
  "category" | "scope" | "tier"
> & {
  category: AchievementCategory;
  scope: AchievementScope;
  tier: AchievementTier;
};

type SyncAchievementPayload = {
  progressCount: number;
  newEventCount: number;
  syncedAt: string;
};

export async function fetchAchievementProgressList() {
  const data = await requestGraphql(AchievementProgressListDocument);
  return data.achievementProgressList as AchievementProgressRecord[];
}

export async function fetchAchievementHistory(input?: { limit?: number; offset?: number }) {
  const limit = Math.max(input?.limit ?? 100, 1);
  const offset = Math.max(input?.offset ?? 0, 0);
  const data = await requestGraphql(AchievementHistoryDocument, { limit, offset });
  return data.achievementHistory as AchievementEventRecord[];
}

export async function syncAchievements() {
  const data = await requestGraphql(SyncAchievementsDocument);
  return data.syncAchievements as SyncAchievementPayload;
}
