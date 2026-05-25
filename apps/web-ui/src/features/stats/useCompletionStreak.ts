import { useMemo } from "react";
import type { StatsDailyActivityDatum } from "./components/types";

type UseCompletionStreakInput = {
  dailySeries: StatsDailyActivityDatum[];
  todayKey: string;
};

function isCompletedDay(day: StatsDailyActivityDatum) {
  return day.done >= 1;
}

export function useCompletionStreak({ dailySeries, todayKey }: UseCompletionStreakInput) {
  return useMemo(() => {
    if (dailySeries.length === 0) {
      return {
        currentCompletionStreak: 0,
        bestCompletionStreak: 0,
        isTodayCompleted: false,
      };
    }

    const completedFlags = dailySeries.map((day) => isCompletedDay(day));

    let bestCompletionStreak = 0;
    let streakRun = 0;
    for (const isCompleted of completedFlags) {
      if (!isCompleted) {
        streakRun = 0;
        continue;
      }
      streakRun += 1;
      if (streakRun > bestCompletionStreak) {
        bestCompletionStreak = streakRun;
      }
    }

    const todayIndex = dailySeries.findIndex((day) => day.key === todayKey);
    const isTodayCompleted = todayIndex >= 0 ? completedFlags[todayIndex] : false;

    let currentCompletionStreak = 0;
    if (todayIndex >= 0 && isTodayCompleted) {
      for (let index = todayIndex; index >= 0; index -= 1) {
        if (!completedFlags[index]) {
          break;
        }
        currentCompletionStreak += 1;
      }
    }

    return {
      currentCompletionStreak,
      bestCompletionStreak,
      isTodayCompleted,
    };
  }, [dailySeries, todayKey]);
}
