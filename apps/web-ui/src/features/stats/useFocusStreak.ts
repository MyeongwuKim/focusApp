import { useMemo } from "react";
import type { StatsDailyActivityDatum } from "./components/types";

type UseFocusStreakInput = {
  dailySeries: StatsDailyActivityDatum[];
  todayKey: string;
};

type StreakState = "active" | "at_risk" | "idle";

function isFocusedDay(day: StatsDailyActivityDatum) {
  return day.focusMin >= 25 || (day.focusMin >= 15 && day.done >= 1);
}

function toDateKeyMs(dateKey: string) {
  const epoch = new Date(`${dateKey}T00:00:00`).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

export function useFocusStreak({ dailySeries, todayKey }: UseFocusStreakInput) {
  return useMemo(() => {
    if (dailySeries.length === 0) {
      return {
        currentStreak: 0,
        bestStreak: 0,
        state: "idle" as StreakState,
        isTodayFocused: false,
        lastFocusedDateKey: null as string | null,
      };
    }

    const focusedFlags = dailySeries.map((day) => isFocusedDay(day));
    let bestStreak = 0;
    let streakRun = 0;

    for (const isFocused of focusedFlags) {
      if (!isFocused) {
        streakRun = 0;
        continue;
      }
      streakRun += 1;
      if (streakRun > bestStreak) {
        bestStreak = streakRun;
      }
    }

    const todayIndex = dailySeries.findIndex((day) => day.key === todayKey);
    const effectiveLastIndex = todayIndex >= 0 ? todayIndex : dailySeries.length - 1;

    let currentStreak = 0;
    for (let index = effectiveLastIndex; index >= 0; index -= 1) {
      if (!focusedFlags[index]) {
        break;
      }
      currentStreak += 1;
    }

    const isTodayFocused = todayIndex >= 0 ? focusedFlags[todayIndex] : false;
    const lastFocusedIndex = [...focusedFlags].lastIndexOf(true);
    const lastFocusedDateKey = lastFocusedIndex >= 0 ? dailySeries[lastFocusedIndex]?.key ?? null : null;

    const yesterdayIndex = todayIndex >= 1 ? todayIndex - 1 : -1;
    const yesterdayFocused = yesterdayIndex >= 0 ? focusedFlags[yesterdayIndex] : false;

    const state: StreakState = isTodayFocused ? "active" : yesterdayFocused ? "at_risk" : "idle";

    const todayMs = toDateKeyMs(todayKey);
    const lastFocusedMs = lastFocusedDateKey ? toDateKeyMs(lastFocusedDateKey) : null;
    const isGapTooLong =
      typeof todayMs === "number" && typeof lastFocusedMs === "number"
        ? Math.floor((todayMs - lastFocusedMs) / (24 * 60 * 60 * 1000)) > 1
        : false;

    return {
      currentStreak: isTodayFocused ? currentStreak : 0,
      bestStreak,
      state: isGapTooLong ? ("idle" as StreakState) : state,
      isTodayFocused,
      lastFocusedDateKey,
    };
  }, [dailySeries, todayKey]);
}
