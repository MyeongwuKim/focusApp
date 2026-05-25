import { Button } from "../../../components/ui/Button";
import type { AchievementProgressRecord } from "../../../api/achievementApi";
import { MetricCardGrid } from "../../stats/components/MetricCardGrid";
import { AchievementProgressBadgeCard } from "./AchievementProgressBadgeCard";
import { AchievementWeeklyChallengeCard } from "./AchievementWeeklyChallengeCard";

type CategoryFilter = "all" | "focus" | "done" | "streak";

type AchievementProgressTabProps = {
  unlockedCount: number;
  totalCount: number;
  focusBestStreak: number;
  doneBestStreak: number;
  weeklyBestStreak: number;
  weeklyAchievedCount: number;
  weeklyChallengeRows: AchievementProgressRecord[];
  activeCategory: CategoryFilter;
  onChangeCategory: (value: CategoryFilter) => void;
  filteredProgressRows: AchievementProgressRecord[];
};

function categoryLabel(category: CategoryFilter) {
  if (category === "all") {
    return "전체";
  }
  if (category === "focus") {
    return "집중";
  }
  if (category === "done") {
    return "완료";
  }
  return "연속";
}

export function AchievementProgressTab({
  unlockedCount,
  totalCount,
  focusBestStreak,
  doneBestStreak,
  weeklyBestStreak,
  weeklyAchievedCount,
  weeklyChallengeRows,
  activeCategory,
  onChangeCategory,
  filteredProgressRows,
}: AchievementProgressTabProps) {
  return (
    <>
      <MetricCardGrid
        className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3"
        items={[
          { label: "달성 배지", value: `${unlockedCount}/${totalCount}` },
          { label: "집중 최고 연속일", value: `${focusBestStreak}일` },
          { label: "완료 최고 연속일", value: `${doneBestStreak}일` },
          { label: "주간 도전 달성", value: `${weeklyAchievedCount}/${weeklyChallengeRows.length}` },
        ]}
      />

      <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 text-sm font-semibold text-base-content/85">주간 도전</h3>
          <span className="text-xs text-base-content/60">최고 연속 {weeklyBestStreak}주</span>
        </div>
        <p className="m-0 mt-1 text-[11px] text-base-content/60">주간 도전은 매주 초기화되며, 히스토리에 달성 기록이 누적됩니다.</p>
        <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
          {weeklyChallengeRows.map((badge) => (
            <AchievementWeeklyChallengeCard key={badge.id} badge={badge} />
          ))}
        </div>
      </article>

      <div className="flex flex-wrap gap-1.5">
        {(["all", "focus", "done", "streak"] as const).map((category) => (
          <Button
            key={category}
            size="xs"
            variant={activeCategory === category ? "primary" : "default"}
            onClick={() => onChangeCategory(category)}
          >
            {categoryLabel(category)}
          </Button>
        ))}
      </div>

      <p className="m-0 text-xs text-base-content/60">달성 배지(영구): 누적/연속 카테고리만 집계</p>
      <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
        {filteredProgressRows.map((badge) => (
          <AchievementProgressBadgeCard key={badge.id} badge={badge} />
        ))}
      </div>
    </>
  );
}
