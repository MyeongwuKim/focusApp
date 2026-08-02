import type { AchievementProgressRecord } from "../../../api/achievementApi";

export function achievementValueUnit(badge: AchievementProgressRecord) {
  if (badge.scope === "streak" || badge.badgeId.startsWith("weekly-done")) {
    return "일";
  }
  if (badge.category === "done") {
    return "개";
  }
  return "분";
}

export function formatAchievementValue(badge: AchievementProgressRecord, value: number) {
  return `${Math.max(Math.floor(value), 0).toLocaleString("ko-KR")}${achievementValueUnit(badge)}`;
}

export function formatAchievementProgress(badge: AchievementProgressRecord) {
  return `${formatAchievementValue(badge, badge.currentValue)} / ${formatAchievementValue(badge, badge.goal)}`;
}

export function formatAchievementRemaining(badge: AchievementProgressRecord) {
  return `${formatAchievementValue(badge, Math.max(badge.goal - badge.currentValue, 0))} 남음`;
}

export function formatAchievementDate(value: string | null | undefined) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return null;
  }
  return date.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
  });
}
