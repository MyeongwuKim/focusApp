import type { AchievementProgressRecord } from "../../../api/achievementApi";

export function achievementTierClassName(tier: AchievementProgressRecord["tier"]) {
  if (tier === "diamond") {
    return "border-cyan-400/65 bg-cyan-300/10";
  }
  if (tier === "ruby") {
    return "border-rose-400/65 bg-rose-300/10";
  }
  if (tier === "platinum") {
    return "border-indigo-400/60 bg-indigo-300/10";
  }
  if (tier === "gold") {
    return "border-yellow-400/55 bg-yellow-400/12";
  }
  if (tier === "silver") {
    return "border-slate-400/55 bg-slate-400/12";
  }
  return "border-amber-600/40 bg-amber-600/10";
}

export function achievementScopeLabel(scope: AchievementProgressRecord["scope"]) {
  if (scope === "total") {
    return "누적";
  }
  if (scope === "streak") {
    return "연속";
  }
  return "주간";
}
