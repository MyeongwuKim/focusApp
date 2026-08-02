import type { Meta, StoryObj } from "@storybook/react";
import type { AchievementProgressRecord } from "../../../api/achievementApi";
import { AchievementProgressTab } from "./AchievementProgressTab";

function createBadge(
  overrides: Partial<AchievementProgressRecord> & Pick<AchievementProgressRecord, "badgeId" | "title">
): AchievementProgressRecord {
  const { badgeId, title, ...rest } = overrides;
  return {
    id: badgeId,
    badgeId,
    title,
    description: "업적 달성 조건",
    icon: "🥉",
    category: "focus",
    scope: "total",
    tier: "bronze",
    goal: 300,
    currentValue: 0,
    isAchieved: false,
    achievedCount: 0,
    lastAchievedAt: null,
    lastAchievedWeekKey: null,
    weeklyStreak: 0,
    bestWeeklyStreak: 0,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...rest,
  };
}

const permanentRows = [
  createBadge({
    badgeId: "focus-bronze",
    title: "집중 브론즈",
    description: "누적 집중 300분",
    currentValue: 220,
  }),
  createBadge({
    badgeId: "done-streak-bronze",
    title: "완료 연속일 브론즈",
    description: "하루 할 일 1개 이상 완료, 3일 연속",
    category: "streak",
    scope: "streak",
    goal: 3,
    currentValue: 2,
  }),
  createBadge({
    badgeId: "done-first",
    title: "첫 체크",
    description: "할 일 첫 완료",
    icon: "✅",
    category: "done",
    goal: 1,
    currentValue: 12,
    isAchieved: true,
    achievedCount: 1,
    lastAchievedAt: "2026-07-28T10:00:00.000Z",
  }),
];

const weeklyRows = [
  createBadge({
    badgeId: "weekly-done-bronze",
    title: "주간 완료 브론즈",
    description: "이번 주(월~일) 완료일 3일",
    category: "weekly",
    scope: "weekly",
    goal: 3,
    currentValue: 2,
    achievedCount: 3,
    bestWeeklyStreak: 2,
  }),
  createBadge({
    badgeId: "weekly-focus-bronze",
    title: "주간 집중 브론즈",
    description: "이번 주(월~일) 집중 150분",
    category: "weekly",
    scope: "weekly",
    goal: 150,
    currentValue: 125,
    achievedCount: 4,
    bestWeeklyStreak: 3,
  }),
];

const meta: Meta<typeof AchievementProgressTab> = {
  title: "Features/Achievement/AchievementProgressTab",
  component: AchievementProgressTab,
  render: () => (
    <div className="h-full space-y-4 overflow-y-auto pr-1">
      <AchievementProgressTab
        unlockedCount={9}
        totalCount={26}
        focusBestStreak={7}
        doneBestStreak={5}
        weeklyBestStreak={3}
        weeklyAchievedCount={0}
        weeklyChallengeRows={weeklyRows}
        nextAchievement={permanentRows[0] ?? null}
        activeCategory="all"
        onChangeCategory={() => {}}
        filteredProgressRows={permanentRows}
      />
    </div>
  ),
};

export default meta;

type Story = StoryObj<typeof AchievementProgressTab>;

export const Default: Story = {};
