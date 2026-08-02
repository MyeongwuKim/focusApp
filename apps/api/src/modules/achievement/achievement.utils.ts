export type AchievementDayStat = {
  doneCount: number;
  focusMinutes: number;
};

export type AchievementMetrics = {
  totalFocusMinutes: number;
  totalDoneTodos: number;
  bestDailyFocusMinutes: number;
  focusStreakCurrent: number;
  focusStreakBest: number;
  doneStreakCurrent: number;
  doneStreakBest: number;
  weeklyDoneDays: number;
  weeklyFocusMinutes: number;
};

export function parseDateKeyToUtc(dateKey: string): Date | null {
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

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }
  return parsed;
}

export function formatUtcDateKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

export function addUtcDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export function shiftDateKey(dateKey: string, days: number) {
  const date = parseDateKeyToUtc(dateKey);
  return date ? formatUtcDateKey(addUtcDays(date, days)) : null;
}

export function getDateKeyInTimeZone(now: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${partValue("year")}-${partValue("month")}-${partValue("day")}`;
}

export function getIsoWeekKeyFromDateKey(dateKey: string) {
  const parsed = parseDateKeyToUtc(dateKey);
  if (!parsed) {
    return null;
  }

  const target = new Date(parsed.getTime());
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNr + 3);
  const weekNumber = 1 + Math.round((target.getTime() - firstThursday.getTime()) / 604800000);
  return `${target.getUTCFullYear()}-W${String(weekNumber).padStart(2, "0")}`;
}

export function buildAchievementMetrics(
  dayMap: Map<string, AchievementDayStat>,
  todayKey: string
): AchievementMetrics {
  const today = parseDateKeyToUtc(todayKey);
  if (!today) {
    throw new Error(`Invalid achievement date key: ${todayKey}`);
  }

  const dateKeys = [...dayMap.keys()].filter((dateKey) => dateKey <= todayKey).sort();
  const firstDate = dateKeys.length > 0 ? parseDateKeyToUtc(dateKeys[0] as string) : null;

  let focusStreakBest = 0;
  let doneStreakBest = 0;
  let focusRun = 0;
  let doneRun = 0;

  if (firstDate) {
    for (
      let cursor = new Date(firstDate.getTime());
      cursor.getTime() <= today.getTime();
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

  const mondayOffset = (today.getUTCDay() + 6) % 7;
  const weekStart = addUtcDays(today, -mondayOffset);
  let weeklyDoneDays = 0;
  let weeklyFocusMinutes = 0;
  for (
    let cursor = new Date(weekStart.getTime());
    cursor.getTime() <= today.getTime();
    cursor = addUtcDays(cursor, 1)
  ) {
    const day = dayMap.get(formatUtcDateKey(cursor));
    if (!day) {
      continue;
    }
    if (day.doneCount >= 1) {
      weeklyDoneDays += 1;
    }
    weeklyFocusMinutes += Math.max(day.focusMinutes, 0);
  }

  const countedDays = dateKeys.map((dateKey) => dayMap.get(dateKey)).filter(Boolean) as AchievementDayStat[];

  return {
    totalDoneTodos: countedDays.reduce((acc, day) => acc + Math.max(day.doneCount, 0), 0),
    totalFocusMinutes: countedDays.reduce((acc, day) => acc + Math.max(day.focusMinutes, 0), 0),
    bestDailyFocusMinutes: countedDays.reduce(
      (best, day) => Math.max(best, Math.max(day.focusMinutes, 0)),
      0
    ),
    doneStreakCurrent: doneRun,
    doneStreakBest,
    focusStreakCurrent: focusRun,
    focusStreakBest,
    weeklyDoneDays,
    weeklyFocusMinutes,
  };
}
