import { describe, expect, it } from "vitest";
import type { AchievementProgressRecord } from "../../../api/achievementApi";
import {
  formatAchievementProgress,
  formatAchievementRemaining,
} from "./achievementProgressFormat";

function createBadge(
  overrides: Partial<AchievementProgressRecord>
): AchievementProgressRecord {
  return {
    id: "achievement-1",
    badgeId: "focus-bronze",
    title: "집중 브론즈",
    description: "누적 집중 300분",
    icon: "🥉",
    category: "focus",
    scope: "total",
    tier: "bronze",
    goal: 300,
    currentValue: 125,
    isAchieved: false,
    achievedCount: 0,
    lastAchievedAt: null,
    lastAchievedWeekKey: null,
    weeklyStreak: 0,
    bestWeeklyStreak: 0,
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("achievement progress formatting", () => {
  it("집중 업적은 분 단위와 남은 진행량을 표시한다", () => {
    const badge = createBadge({});

    expect(formatAchievementProgress(badge)).toBe("125분 / 300분");
    expect(formatAchievementRemaining(badge)).toBe("175분 남음");
  });

  it("완료와 연속 업적에 각각 개수와 일 단위를 사용한다", () => {
    expect(
      formatAchievementProgress(
        createBadge({ badgeId: "done-bronze", category: "done", currentValue: 12, goal: 20 })
      )
    ).toBe("12개 / 20개");
    expect(
      formatAchievementProgress(
        createBadge({ badgeId: "done-streak-silver", category: "streak", scope: "streak", currentValue: 4, goal: 7 })
      )
    ).toBe("4일 / 7일");
  });
});
