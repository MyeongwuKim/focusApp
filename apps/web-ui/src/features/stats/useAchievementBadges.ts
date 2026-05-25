import { useMemo } from "react";
import type { StatsDailyActivityDatum } from "./components/types";

type AchievementTier = "bronze" | "silver" | "gold" | "platinum" | "ruby" | "diamond";
type AchievementScope = "total" | "streak" | "weekly";

type BadgeRule = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  scope: AchievementScope;
  goal: number;
  metric:
    | "focus"
    | "done"
    | "streak"
    | "completion_streak"
    | "weekly_done_days"
    | "weekly_focus";
};

export type AchievementBadge = BadgeRule & {
  unlocked: boolean;
  current: number;
  progressPercent: number;
};

type UseAchievementBadgesInput = {
  totalFocusMinutes: number;
  doneTodos: number;
  bestStreak: number;
  bestCompletionStreak: number;
  dailySeries: StatsDailyActivityDatum[];
  todayKey: string;
};

const BADGE_RULES: BadgeRule[] = [
  {
    id: "focus-bronze",
    name: "집중 브론즈",
    description: "누적 집중 300분",
    icon: "🥉",
    tier: "bronze",
    scope: "total",
    goal: 300,
    metric: "focus",
  },
  {
    id: "focus-silver",
    name: "집중 실버",
    description: "누적 집중 1200분",
    icon: "🥈",
    tier: "silver",
    scope: "total",
    goal: 1200,
    metric: "focus",
  },
  {
    id: "focus-gold",
    name: "집중 골드",
    description: "누적 집중 3000분",
    icon: "🥇",
    tier: "gold",
    scope: "total",
    goal: 3000,
    metric: "focus",
  },
  {
    id: "focus-platinum",
    name: "집중 플래티넘",
    description: "누적 집중 6000분",
    icon: "🏅",
    tier: "platinum",
    scope: "total",
    goal: 6000,
    metric: "focus",
  },
  {
    id: "focus-ruby",
    name: "집중 루비",
    description: "누적 집중 10000분",
    icon: "💎",
    tier: "ruby",
    scope: "total",
    goal: 10000,
    metric: "focus",
  },
  {
    id: "focus-diamond",
    name: "집중 다이아몬드",
    description: "누적 집중 15000분",
    icon: "💠",
    tier: "diamond",
    scope: "total",
    goal: 15000,
    metric: "focus",
  },
  {
    id: "done-bronze",
    name: "완료 브론즈",
    description: "완료 할일 20개",
    icon: "🎖️",
    tier: "bronze",
    scope: "total",
    goal: 20,
    metric: "done",
  },
  {
    id: "done-silver",
    name: "완료 실버",
    description: "완료 할일 60개",
    icon: "🏅",
    tier: "silver",
    scope: "total",
    goal: 60,
    metric: "done",
  },
  {
    id: "done-gold",
    name: "완료 골드",
    description: "완료 할일 150개",
    icon: "🏆",
    tier: "gold",
    scope: "total",
    goal: 150,
    metric: "done",
  },
  {
    id: "done-platinum",
    name: "완료 플래티넘",
    description: "완료 할일 300개",
    icon: "🥇",
    tier: "platinum",
    scope: "total",
    goal: 300,
    metric: "done",
  },
  {
    id: "done-ruby",
    name: "완료 루비",
    description: "완료 할일 500개",
    icon: "💎",
    tier: "ruby",
    scope: "total",
    goal: 500,
    metric: "done",
  },
  {
    id: "done-diamond",
    name: "완료 다이아몬드",
    description: "완료 할일 1000개",
    icon: "💠",
    tier: "diamond",
    scope: "total",
    goal: 1000,
    metric: "done",
  },
  {
    id: "done-streak-bronze",
    name: "완료 연속일 브론즈",
    description: "하루 1개 이상 완료 3일 연속",
    icon: "🥉",
    tier: "bronze",
    scope: "streak",
    goal: 3,
    metric: "completion_streak",
  },
  {
    id: "done-streak-silver",
    name: "완료 연속일 실버",
    description: "하루 1개 이상 완료 7일 연속",
    icon: "🏅",
    tier: "silver",
    scope: "streak",
    goal: 7,
    metric: "completion_streak",
  },
  {
    id: "done-streak-gold",
    name: "완료 연속일 골드",
    description: "하루 1개 이상 완료 14일 연속",
    icon: "🥇",
    tier: "gold",
    scope: "streak",
    goal: 14,
    metric: "completion_streak",
  },
  {
    id: "done-streak-platinum",
    name: "완료 연속일 플래티넘",
    description: "하루 1개 이상 완료 30일 연속",
    icon: "🏆",
    tier: "platinum",
    scope: "streak",
    goal: 30,
    metric: "completion_streak",
  },
  {
    id: "done-streak-ruby",
    name: "완료 연속일 루비",
    description: "하루 1개 이상 완료 60일 연속",
    icon: "💎",
    tier: "ruby",
    scope: "streak",
    goal: 60,
    metric: "completion_streak",
  },
  {
    id: "done-streak-diamond",
    name: "완료 연속일 다이아몬드",
    description: "하루 1개 이상 완료 100일 연속",
    icon: "💠",
    tier: "diamond",
    scope: "streak",
    goal: 100,
    metric: "completion_streak",
  },
  {
    id: "weekly-done-bronze",
    name: "주간 완료 브론즈",
    description: "최근 7일 중 완료일 3일",
    icon: "📆",
    tier: "bronze",
    scope: "weekly",
    goal: 3,
    metric: "weekly_done_days",
  },
  {
    id: "weekly-done-silver",
    name: "주간 완료 실버",
    description: "최근 7일 중 완료일 5일",
    icon: "🗓️",
    tier: "silver",
    scope: "weekly",
    goal: 5,
    metric: "weekly_done_days",
  },
  {
    id: "weekly-done-gold",
    name: "주간 완료 골드",
    description: "최근 7일 중 완료일 7일",
    icon: "✅",
    tier: "gold",
    scope: "weekly",
    goal: 7,
    metric: "weekly_done_days",
  },
  {
    id: "weekly-focus-bronze",
    name: "주간 집중 브론즈",
    description: "최근 7일 집중 150분",
    icon: "⏱️",
    tier: "bronze",
    scope: "weekly",
    goal: 150,
    metric: "weekly_focus",
  },
  {
    id: "weekly-focus-silver",
    name: "주간 집중 실버",
    description: "최근 7일 집중 300분",
    icon: "⌛",
    tier: "silver",
    scope: "weekly",
    goal: 300,
    metric: "weekly_focus",
  },
  {
    id: "weekly-focus-gold",
    name: "주간 집중 골드",
    description: "최근 7일 집중 600분",
    icon: "🔥",
    tier: "gold",
    scope: "weekly",
    goal: 600,
    metric: "weekly_focus",
  },
];

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

function addDays(date: Date, offset: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + offset);
  return next;
}

function formatDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function useAchievementBadges({
  totalFocusMinutes,
  doneTodos,
  bestStreak,
  bestCompletionStreak,
  dailySeries,
  todayKey,
}: UseAchievementBadgesInput) {
  return useMemo(() => {
    const today = new Date(`${todayKey}T00:00:00`);
    const seriesMap = new Map(dailySeries.map((day) => [day.key, day]));
    const recentWeek = Array.from({ length: 7 }, (_, idx) => {
      const offset = idx - 6;
      const key = formatDateKey(addDays(today, offset));
      return seriesMap.get(key);
    }).filter((day): day is StatsDailyActivityDatum => Boolean(day));
    const weeklyDoneDays = recentWeek.filter((day) => day.done >= 1).length;
    const weeklyFocusMinutes = recentWeek.reduce((acc, day) => acc + Math.max(day.focusMin, 0), 0);

    const badges: AchievementBadge[] = BADGE_RULES.map((rule) => {
      const current = (() => {
        if (rule.metric === "focus") {
          return totalFocusMinutes;
        }
        if (rule.metric === "done") {
          return doneTodos;
        }
        if (rule.metric === "completion_streak") {
          return bestCompletionStreak;
        }
        if (rule.metric === "weekly_done_days") {
          return weeklyDoneDays;
        }
        if (rule.metric === "weekly_focus") {
          return weeklyFocusMinutes;
        }
        return bestStreak;
      })();
      const unlocked = current >= rule.goal;
      const progressPercent = unlocked ? 100 : clampPercent((current / rule.goal) * 100);
      return {
        ...rule,
        unlocked,
        current,
        progressPercent,
      };
    });

    return {
      badges,
      unlockedCount: badges.filter((badge) => badge.unlocked).length,
      totalCount: badges.length,
    };
  }, [bestCompletionStreak, bestStreak, dailySeries, doneTodos, todayKey, totalFocusMinutes]);
}
