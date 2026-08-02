import type { AchievementProgressRecord } from "../../../api/achievementApi";
import { achievementScopeLabel, achievementTierClassName } from "./achievementCardStyles";
import {
  formatAchievementDate,
  formatAchievementProgress,
  formatAchievementRemaining,
} from "./achievementProgressFormat";

type AchievementProgressBadgeCardProps = {
  badge: AchievementProgressRecord;
};

export function AchievementProgressBadgeCard({ badge }: AchievementProgressBadgeCardProps) {
  const progressPercent = Math.max(0, Math.min(100, badge.goal > 0 ? (badge.currentValue / badge.goal) * 100 : 0));
  const achievedDate = formatAchievementDate(badge.lastAchievedAt);

  return (
    <article
      className={[
        "rounded-lg border px-3 py-2 transition-opacity",
        achievementTierClassName(badge.tier),
        badge.isAchieved ? "opacity-100" : "opacity-70",
      ].join(" ")}
    >
      <div className="flex items-start gap-2">
        <span className="text-lg leading-none" aria-hidden>
          {badge.icon}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="m-0 text-sm font-semibold text-base-content/90">{badge.title}</p>
            <span className="rounded-full bg-base-100/75 px-1.5 py-0.5 text-[10px] text-base-content/60">
              {achievementScopeLabel(badge)}
            </span>
          </div>
          <p className="m-0 mt-0.5 text-[11px] text-base-content/65">{badge.description}</p>
        </div>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
            badge.isAchieved ? "bg-emerald-500/15 text-emerald-700" : "bg-base-300/65 text-base-content/60",
          ].join(" ")}
        >
          {badge.isAchieved ? "달성" : "진행"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-300/65">
        <div
          className={["h-full rounded-full", badge.isAchieved ? "bg-emerald-500" : "bg-base-content/35"].join(" ")}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between gap-2 text-[10px] text-base-content/55">
        <span>
          {formatAchievementProgress(badge)}
        </span>
        <span>{badge.isAchieved ? (achievedDate ? `${achievedDate} 달성` : "달성 완료") : formatAchievementRemaining(badge)}</span>
      </div>
    </article>
  );
}
