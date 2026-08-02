import type { AchievementProgressRecord } from "../../../api/achievementApi";
import { achievementTierClassName } from "./achievementCardStyles";
import { formatAchievementProgress } from "./achievementProgressFormat";

type AchievementWeeklyChallengeCardProps = {
  badge: AchievementProgressRecord;
};

export function AchievementWeeklyChallengeCard({ badge }: AchievementWeeklyChallengeCardProps) {
  const progressPercent = Math.max(0, Math.min(100, badge.goal > 0 ? (badge.currentValue / badge.goal) * 100 : 0));

  return (
    <div className={["rounded-lg border px-3 py-2", achievementTierClassName(badge.tier)].join(" ")}>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none" aria-hidden>
          {badge.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-sm font-semibold text-base-content/90">{badge.title}</p>
          <p className="m-0 mt-0.5 text-[11px] text-base-content/65">{badge.description}</p>
        </div>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            badge.isAchieved ? "bg-emerald-500/15 text-emerald-700" : "bg-base-300/65 text-base-content/60",
          ].join(" ")}
        >
          {badge.isAchieved ? "이번 주 달성" : "진행 중"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-300/65">
        <div className="h-full rounded-full bg-base-content/35" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-base-content/55">
        <span>
          {formatAchievementProgress(badge)}
        </span>
        <span>{badge.achievedCount}회 달성</span>
      </div>
    </div>
  );
}
