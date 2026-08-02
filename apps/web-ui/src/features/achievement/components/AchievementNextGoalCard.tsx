import type { AchievementProgressRecord } from "../../../api/achievementApi";
import { achievementTierClassName } from "./achievementCardStyles";
import {
  formatAchievementProgress,
  formatAchievementRemaining,
} from "./achievementProgressFormat";

type AchievementNextGoalCardProps = {
  badge: AchievementProgressRecord | null;
};

export function AchievementNextGoalCard({ badge }: AchievementNextGoalCardProps) {
  if (!badge) {
    return (
      <article className="rounded-xl border border-emerald-400/50 bg-emerald-400/10 p-3">
        <p className="m-0 text-xs font-semibold text-emerald-700">모든 영구 업적 달성</p>
        <p className="m-0 mt-1 text-[11px] text-base-content/65">
          이번 주 도전을 이어가며 연속 기록을 쌓아보세요.
        </p>
      </article>
    );
  }

  const progressPercent = Math.max(
    0,
    Math.min(100, badge.goal > 0 ? (badge.currentValue / badge.goal) * 100 : 0)
  );

  return (
    <article className={["rounded-xl border p-3", achievementTierClassName(badge.tier)].join(" ")}>
      <div className="flex items-start gap-2">
        <span className="text-2xl leading-none" aria-hidden>
          {badge.icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[11px] font-semibold text-primary">다음 업적</p>
          <p className="m-0 mt-0.5 text-sm font-semibold text-base-content/90">{badge.title}</p>
          <p className="m-0 mt-0.5 text-[11px] text-base-content/65">{badge.description}</p>
        </div>
        <span className="shrink-0 rounded-full bg-base-100/75 px-2 py-1 text-[10px] font-semibold text-base-content/65">
          {formatAchievementRemaining(badge)}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-base-300/65">
        <div className="h-full rounded-full bg-primary" style={{ width: `${progressPercent}%` }} />
      </div>
      <p className="m-0 mt-1 text-right text-[10px] text-base-content/55">
        {formatAchievementProgress(badge)}
      </p>
    </article>
  );
}
