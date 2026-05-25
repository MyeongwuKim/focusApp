import { gql } from "graphql-tag";
import type { GraphQLContext } from "../../graphql/context.js";
import { requireUserId } from "../../common/utils/require-user-id.js";

type BadgeDefinition = {
  id: string;
  title: string;
  description: string;
  icon: string;
  category: "focus" | "done" | "streak" | "weekly";
  scope: "total" | "streak" | "weekly";
  tier: "bronze" | "silver" | "gold" | "platinum" | "ruby" | "diamond";
  goal: number;
  metric:
    | "focus_total"
    | "done_total"
    | "focus_streak"
    | "done_streak"
    | "weekly_done_days"
    | "weekly_focus_minutes";
};

type DayStat = {
  doneCount: number;
  focusMinutes: number;
};

type AchievementMetrics = {
  totalFocusMinutes: number;
  totalDoneTodos: number;
  focusStreakCurrent: number;
  focusStreakBest: number;
  doneStreakCurrent: number;
  doneStreakBest: number;
  weeklyDoneDays: number;
  weeklyFocusMinutes: number;
};

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: "focus-bronze", title: "집중 브론즈", description: "누적 집중 300분", icon: "🥉", category: "focus", scope: "total", tier: "bronze", goal: 300, metric: "focus_total" },
  { id: "focus-silver", title: "집중 실버", description: "누적 집중 1200분", icon: "🥈", category: "focus", scope: "total", tier: "silver", goal: 1200, metric: "focus_total" },
  { id: "focus-gold", title: "집중 골드", description: "누적 집중 3000분", icon: "🥇", category: "focus", scope: "total", tier: "gold", goal: 3000, metric: "focus_total" },
  { id: "focus-platinum", title: "집중 플래티넘", description: "누적 집중 6000분", icon: "🔷", category: "focus", scope: "total", tier: "platinum", goal: 6000, metric: "focus_total" },
  { id: "focus-ruby", title: "집중 루비", description: "누적 집중 10000분", icon: "♦️", category: "focus", scope: "total", tier: "ruby", goal: 10000, metric: "focus_total" },
  { id: "focus-diamond", title: "집중 다이아몬드", description: "누적 집중 15000분", icon: "💎", category: "focus", scope: "total", tier: "diamond", goal: 15000, metric: "focus_total" },

  { id: "done-bronze", title: "완료 브론즈", description: "완료 할일 20개", icon: "🥉", category: "done", scope: "total", tier: "bronze", goal: 20, metric: "done_total" },
  { id: "done-silver", title: "완료 실버", description: "완료 할일 60개", icon: "🥈", category: "done", scope: "total", tier: "silver", goal: 60, metric: "done_total" },
  { id: "done-gold", title: "완료 골드", description: "완료 할일 150개", icon: "🥇", category: "done", scope: "total", tier: "gold", goal: 150, metric: "done_total" },
  { id: "done-platinum", title: "완료 플래티넘", description: "완료 할일 300개", icon: "🔷", category: "done", scope: "total", tier: "platinum", goal: 300, metric: "done_total" },
  { id: "done-ruby", title: "완료 루비", description: "완료 할일 500개", icon: "♦️", category: "done", scope: "total", tier: "ruby", goal: 500, metric: "done_total" },
  { id: "done-diamond", title: "완료 다이아몬드", description: "완료 할일 1000개", icon: "💎", category: "done", scope: "total", tier: "diamond", goal: 1000, metric: "done_total" },

  { id: "focus-streak-bronze", title: "집중 연속일 브론즈", description: "집중 연속일 3일", icon: "🥉", category: "streak", scope: "streak", tier: "bronze", goal: 3, metric: "focus_streak" },
  { id: "focus-streak-silver", title: "집중 연속일 실버", description: "집중 연속일 7일", icon: "🥈", category: "streak", scope: "streak", tier: "silver", goal: 7, metric: "focus_streak" },
  { id: "focus-streak-gold", title: "집중 연속일 골드", description: "집중 연속일 14일", icon: "🥇", category: "streak", scope: "streak", tier: "gold", goal: 14, metric: "focus_streak" },
  { id: "focus-streak-platinum", title: "집중 연속일 플래티넘", description: "집중 연속일 30일", icon: "🔷", category: "streak", scope: "streak", tier: "platinum", goal: 30, metric: "focus_streak" },
  { id: "focus-streak-ruby", title: "집중 연속일 루비", description: "집중 연속일 60일", icon: "♦️", category: "streak", scope: "streak", tier: "ruby", goal: 60, metric: "focus_streak" },
  { id: "focus-streak-diamond", title: "집중 연속일 다이아몬드", description: "집중 연속일 100일", icon: "💎", category: "streak", scope: "streak", tier: "diamond", goal: 100, metric: "focus_streak" },

  { id: "done-streak-bronze", title: "완료 연속일 브론즈", description: "완료 연속일 3일", icon: "🥉", category: "streak", scope: "streak", tier: "bronze", goal: 3, metric: "done_streak" },
  { id: "done-streak-silver", title: "완료 연속일 실버", description: "완료 연속일 7일", icon: "🥈", category: "streak", scope: "streak", tier: "silver", goal: 7, metric: "done_streak" },
  { id: "done-streak-gold", title: "완료 연속일 골드", description: "완료 연속일 14일", icon: "🥇", category: "streak", scope: "streak", tier: "gold", goal: 14, metric: "done_streak" },
  { id: "done-streak-platinum", title: "완료 연속일 플래티넘", description: "완료 연속일 30일", icon: "🔷", category: "streak", scope: "streak", tier: "platinum", goal: 30, metric: "done_streak" },
  { id: "done-streak-ruby", title: "완료 연속일 루비", description: "완료 연속일 60일", icon: "♦️", category: "streak", scope: "streak", tier: "ruby", goal: 60, metric: "done_streak" },
  { id: "done-streak-diamond", title: "완료 연속일 다이아몬드", description: "완료 연속일 100일", icon: "💎", category: "streak", scope: "streak", tier: "diamond", goal: 100, metric: "done_streak" },

  { id: "weekly-done-bronze", title: "주간 완료 브론즈", description: "최근 7일 중 완료일 3일", icon: "🥉", category: "weekly", scope: "weekly", tier: "bronze", goal: 3, metric: "weekly_done_days" },
  { id: "weekly-done-silver", title: "주간 완료 실버", description: "최근 7일 중 완료일 5일", icon: "🥈", category: "weekly", scope: "weekly", tier: "silver", goal: 5, metric: "weekly_done_days" },
  { id: "weekly-done-gold", title: "주간 완료 골드", description: "최근 7일 중 완료일 7일", icon: "🥇", category: "weekly", scope: "weekly", tier: "gold", goal: 7, metric: "weekly_done_days" },
  { id: "weekly-focus-bronze", title: "주간 집중 브론즈", description: "최근 7일 집중 150분", icon: "🥉", category: "weekly", scope: "weekly", tier: "bronze", goal: 150, metric: "weekly_focus_minutes" },
  { id: "weekly-focus-silver", title: "주간 집중 실버", description: "최근 7일 집중 300분", icon: "🥈", category: "weekly", scope: "weekly", tier: "silver", goal: 300, metric: "weekly_focus_minutes" },
  { id: "weekly-focus-gold", title: "주간 집중 골드", description: "최근 7일 집중 600분", icon: "🥇", category: "weekly", scope: "weekly", tier: "gold", goal: 600, metric: "weekly_focus_minutes" },
];

export const achievementTypeDefs = gql`
  type AchievementProgress {
    id: ID!
    badgeId: String!
    title: String!
    description: String!
    icon: String!
    category: String!
    scope: String!
    tier: String!
    goal: Int!
    currentValue: Int!
    isAchieved: Boolean!
    achievedCount: Int!
    lastAchievedAt: String
    lastAchievedWeekKey: String
    weeklyStreak: Int!
    bestWeeklyStreak: Int!
    updatedAt: String!
  }

  type AchievementEvent {
    id: ID!
    badgeId: String!
    title: String!
    description: String!
    icon: String!
    category: String!
    scope: String!
    tier: String!
    goal: Int!
    currentValue: Int!
    cycleIndex: Int!
    weekKey: String
    weeklyStreak: Int
    achievedAt: String!
  }

  type AchievementSyncPayload {
    progressCount: Int!
    newEventCount: Int!
    syncedAt: String!
  }

  extend type Query {
    achievementProgressList: [AchievementProgress!]!
    achievementHistory(limit: Int, offset: Int): [AchievementEvent!]!
  }

  extend type Mutation {
    syncAchievements: AchievementSyncPayload!
  }
`;

function getUserId(context: GraphQLContext) {
  return requireUserId(context);
}

function parseDateKeyToUtc(dateKey: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  return new Date(Date.UTC(year, month - 1, day));
}

function formatUtcDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function getIsoWeekKey(date: Date) {
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

function toIsoStringOrNull(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function buildMetrics(dayMap: Map<string, DayStat>) {
  const today = new Date();
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));

  const dateKeys = [...dayMap.keys()].sort();
  const firstDate = dateKeys.length > 0 ? parseDateKeyToUtc(dateKeys[0] as string) : null;

  let focusStreakCurrent = 0;
  let focusStreakBest = 0;
  let doneStreakCurrent = 0;
  let doneStreakBest = 0;

  let focusRun = 0;
  let doneRun = 0;

  if (firstDate) {
    for (
      let cursor = new Date(firstDate.getTime());
      cursor.getTime() <= todayUtc.getTime();
      cursor = addUtcDays(cursor, 1)
    ) {
      const key = formatUtcDateKey(cursor);
      const day = dayMap.get(key) ?? { doneCount: 0, focusMinutes: 0 };

      const doneSuccess = day.doneCount >= 1;
      const focusSuccess = day.focusMinutes >= 25 || (day.focusMinutes >= 15 && day.doneCount >= 1);

      doneRun = doneSuccess ? doneRun + 1 : 0;
      focusRun = focusSuccess ? focusRun + 1 : 0;

      doneStreakBest = Math.max(doneStreakBest, doneRun);
      focusStreakBest = Math.max(focusStreakBest, focusRun);
    }
  }

  doneStreakCurrent = doneRun;
  focusStreakCurrent = focusRun;

  let weeklyDoneDays = 0;
  let weeklyFocusMinutes = 0;
  for (let i = 6; i >= 0; i -= 1) {
    const key = formatUtcDateKey(addUtcDays(todayUtc, -i));
    const day = dayMap.get(key);
    if (!day) {
      continue;
    }
    if (day.doneCount >= 1) {
      weeklyDoneDays += 1;
    }
    weeklyFocusMinutes += Math.max(day.focusMinutes, 0);
  }

  const totalDoneTodos = [...dayMap.values()].reduce((acc, day) => acc + day.doneCount, 0);
  const totalFocusMinutes = [...dayMap.values()].reduce((acc, day) => acc + day.focusMinutes, 0);

  return {
    totalDoneTodos,
    totalFocusMinutes,
    doneStreakCurrent,
    doneStreakBest,
    focusStreakCurrent,
    focusStreakBest,
    weeklyDoneDays,
    weeklyFocusMinutes,
  } as AchievementMetrics;
}

function getBadgeCurrentValue(definition: BadgeDefinition, metrics: AchievementMetrics) {
  if (definition.metric === "focus_total") {
    return metrics.totalFocusMinutes;
  }
  if (definition.metric === "done_total") {
    return metrics.totalDoneTodos;
  }
  if (definition.metric === "focus_streak") {
    return metrics.focusStreakBest;
  }
  if (definition.metric === "done_streak") {
    return metrics.doneStreakBest;
  }
  if (definition.metric === "weekly_done_days") {
    return metrics.weeklyDoneDays;
  }
  return metrics.weeklyFocusMinutes;
}

async function syncAchievementsForUser(context: GraphQLContext, userId: string) {
  const dailyLogs = await context.prisma.dailyLog.findMany({
    where: { userId },
    select: {
      dateKey: true,
      todos: true,
    },
  });

  const dayMap = new Map<string, DayStat>();
  for (const log of dailyLogs) {
    const doneCount = log.todos.filter((todo) => todo.done).length;
    const focusMinutes = Math.floor(
      log.todos.reduce((acc, todo) => acc + Math.max(todo.actualFocusSeconds ?? 0, 0), 0) / 60
    );
    dayMap.set(log.dateKey, { doneCount, focusMinutes });
  }

  const metrics = buildMetrics(dayMap);

  const existingProgressRows = await context.prisma.achievementProgress.findMany({
    where: { userId },
  });
  const existingEventRows = await context.prisma.achievementEvent.findMany({
    where: { userId },
    orderBy: { achievedAt: "desc" },
  });

  const existingProgressMap = new Map(existingProgressRows.map((row) => [row.badgeId, row]));
  const existingEventByBadgeWeek = new Map(
    existingEventRows
      .filter((row) => typeof row.weekKey === "string" && row.weekKey.length > 0)
      .map((row) => [`${row.badgeId}:${row.weekKey}`, row])
  );
  const latestEventByBadge = new Map<string, (typeof existingEventRows)[number]>();
  for (const row of existingEventRows) {
    if (!latestEventByBadge.has(row.badgeId)) {
      latestEventByBadge.set(row.badgeId, row);
    }
  }

  const now = new Date();
  const currentWeekKey = getIsoWeekKey(now);
  const previousWeekKey = getIsoWeekKey(addUtcDays(now, -7));

  let newEventCount = 0;

  for (const definition of BADGE_DEFINITIONS) {
    const currentValue = getBadgeCurrentValue(definition, metrics);
    const achievedNow = currentValue >= definition.goal;
    const previous = existingProgressMap.get(definition.id);

    let achievedCount = Math.max(previous?.achievedCount ?? 0, 0);
    let lastAchievedAt = previous?.lastAchievedAt ?? null;
    let lastAchievedWeekKey = previous?.lastAchievedWeekKey ?? null;
    let weeklyStreak = Math.max(previous?.weeklyStreak ?? 0, 0);
    let bestWeeklyStreak = Math.max(previous?.bestWeeklyStreak ?? 0, 0);

    if (definition.scope === "weekly") {
      const eventKey = `${definition.id}:${currentWeekKey}`;
      const hasCurrentWeekEvent = existingEventByBadgeWeek.has(eventKey);

      if (achievedNow && !hasCurrentWeekEvent) {
        const latestBadgeEvent = latestEventByBadge.get(definition.id);
        const previousWeekStreak =
          latestBadgeEvent?.weekKey === previousWeekKey
            ? Math.max(latestBadgeEvent.weeklyStreak ?? 0, 0)
            : 0;
        const nextWeeklyStreak = previousWeekStreak + 1;

        achievedCount += 1;
        lastAchievedAt = now;
        lastAchievedWeekKey = currentWeekKey;
        weeklyStreak = nextWeeklyStreak;
        bestWeeklyStreak = Math.max(bestWeeklyStreak, nextWeeklyStreak);

        const event = await context.prisma.achievementEvent.create({
          data: {
            userId,
            badgeId: definition.id,
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            category: definition.category,
            scope: definition.scope,
            tier: definition.tier,
            goal: definition.goal,
            currentValue,
            cycleIndex: achievedCount,
            weekKey: currentWeekKey,
            weeklyStreak: nextWeeklyStreak,
            achievedAt: now,
          },
        });
        existingEventByBadgeWeek.set(eventKey, event);
        latestEventByBadge.set(definition.id, event);
        newEventCount += 1;
      }

      if (!achievedNow) {
        weeklyStreak = 0;
      }
    } else {
      const previouslyAchieved = Boolean(previous?.isAchieved);
      if (achievedNow && !previouslyAchieved) {
        achievedCount = 1;
        lastAchievedAt = now;

        const event = await context.prisma.achievementEvent.create({
          data: {
            userId,
            badgeId: definition.id,
            title: definition.title,
            description: definition.description,
            icon: definition.icon,
            category: definition.category,
            scope: definition.scope,
            tier: definition.tier,
            goal: definition.goal,
            currentValue,
            cycleIndex: 1,
            achievedAt: now,
          },
        });
        latestEventByBadge.set(definition.id, event);
        newEventCount += 1;
      }
    }

    await context.prisma.achievementProgress.upsert({
      where: {
        userId_badgeId: {
          userId,
          badgeId: definition.id,
        },
      },
      create: {
        userId,
        badgeId: definition.id,
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        category: definition.category,
        scope: definition.scope,
        tier: definition.tier,
        goal: definition.goal,
        currentValue,
        isAchieved: definition.scope === "weekly" ? achievedNow : currentValue >= definition.goal,
        achievedCount,
        lastAchievedAt,
        lastAchievedWeekKey,
        weeklyStreak,
        bestWeeklyStreak,
      },
      update: {
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        category: definition.category,
        scope: definition.scope,
        tier: definition.tier,
        goal: definition.goal,
        currentValue,
        isAchieved: definition.scope === "weekly" ? achievedNow : currentValue >= definition.goal,
        achievedCount,
        lastAchievedAt,
        lastAchievedWeekKey,
        weeklyStreak,
        bestWeeklyStreak,
      },
    });

    // 과거 히스토리도 최신 배지 메타(아이콘/호칭/등급)로 정규화
    await context.prisma.achievementEvent.updateMany({
      where: {
        userId,
        badgeId: definition.id,
      },
      data: {
        title: definition.title,
        description: definition.description,
        icon: definition.icon,
        category: definition.category,
        scope: definition.scope,
        tier: definition.tier,
        goal: definition.goal,
      },
    });
  }

  return {
    progressCount: BADGE_DEFINITIONS.length,
    newEventCount,
    syncedAt: now.toISOString(),
  };
}

export const achievementResolvers = {
  Query: {
    achievementProgressList: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const userId = getUserId(context);
      const rows = await context.prisma.achievementProgress.findMany({
        where: { userId },
        orderBy: [{ category: "asc" }, { goal: "asc" }],
      });

      return rows.map((row) => ({
        ...row,
        lastAchievedAt: toIsoStringOrNull(row.lastAchievedAt),
        updatedAt: row.updatedAt.toISOString(),
      }));
    },
    achievementHistory: async (
      _parent: unknown,
      args: { limit?: number | null; offset?: number | null },
      context: GraphQLContext
    ) => {
      const userId = getUserId(context);
      const limit = Math.max(Math.min(args.limit ?? 50, 200), 1);
      const offset = Math.max(args.offset ?? 0, 0);
      const rows = await context.prisma.achievementEvent.findMany({
        where: { userId },
        orderBy: { achievedAt: "desc" },
        skip: offset,
        take: limit,
      });

      return rows.map((row) => ({
        ...row,
        achievedAt: row.achievedAt.toISOString(),
      }));
    },
  },
  Mutation: {
    syncAchievements: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const userId = getUserId(context);
      return syncAchievementsForUser(context, userId);
    },
  },
};
