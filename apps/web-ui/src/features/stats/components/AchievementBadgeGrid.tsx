import type { AchievementBadge } from "../useAchievementBadges";

type AchievementBadgeGridProps = {
  badges: AchievementBadge[];
  unlockedCount: number;
  totalCount: number;
};

function tierClassName(tier: AchievementBadge["tier"]) {
  if (tier === "gold") {
    return "border-yellow-400/55 bg-yellow-400/12";
  }
  if (tier === "silver") {
    return "border-slate-400/55 bg-slate-400/12";
  }
  if (tier === "bronze") {
    return "border-amber-600/40 bg-amber-600/10";
  }
  return "border-emerald-500/45 bg-emerald-500/10";
}

function scopeLabel(scope: AchievementBadge["scope"]) {
  if (scope === "total") {
    return "누적";
  }
  if (scope === "streak") {
    return "연속";
  }
  return "주간";
}

export function AchievementBadgeGrid({ badges, unlockedCount, totalCount }: AchievementBadgeGridProps) {
  return (
    <article className="space-y-2 rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content/85">달성 배지</h3>
        <span className="text-xs text-base-content/60">
          {unlockedCount}/{totalCount} 달성
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className={[
              "rounded-lg border px-3 py-2 transition-opacity",
              tierClassName(badge.tier),
              badge.unlocked ? "opacity-100" : "opacity-60",
            ].join(" ")}
          >
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none" aria-hidden>
                {badge.icon}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="m-0 text-sm font-semibold text-base-content/90">{badge.name}</p>
                  <span className="rounded-full bg-base-100/75 px-1.5 py-0.5 text-[10px] text-base-content/60">
                    {scopeLabel(badge.scope)}
                  </span>
                </div>
                <p className="m-0 mt-0.5 text-[11px] text-base-content/65">{badge.description}</p>
              </div>
              <span
                className={[
                  "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                  badge.unlocked ? "bg-emerald-500/15 text-emerald-700" : "bg-base-300/65 text-base-content/60",
                ].join(" ")}
              >
                {badge.unlocked ? "달성" : "진행"}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-300/65">
              <div
                className={[
                  "h-full rounded-full",
                  badge.unlocked ? "bg-emerald-500" : "bg-base-content/35",
                ].join(" ")}
                style={{ width: `${badge.progressPercent}%` }}
              />
            </div>
            <p className="m-0 mt-1 text-[10px] text-base-content/55">
              {badge.current}/{badge.goal}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
