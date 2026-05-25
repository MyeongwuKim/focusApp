import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchDailyLogByDate } from "../../api/dailyLogApi";
import { statsDailyDetailQueryKey, useDailyLogQuery } from "../../queries";
import { addDays, formatDateInput, getMonthKeysBetween, getRangeDays, parseInputDate } from "./statsDate";
import type { CountBarDatum, StatsDailyActivityDatum, TimeBarDatum } from "./components/types";

function toEpochMillis(value: string | null) {
  if (!value) {
    return null;
  }
  const epoch = new Date(value).getTime();
  return Number.isFinite(epoch) ? epoch : null;
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, value));
}

type UseStatsMetricsInput = {
  start: Date;
  end: Date;
  todayKey: string;
  taskId?: string;
  taskLabel?: string;
  enabled?: boolean;
};

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function matchesTask(
  todo: { taskId?: string | null; titleSnapshot?: string | null; content: string },
  taskId?: string,
  taskLabel?: string
) {
  if (!taskId) {
    return true;
  }
  if (todo.taskId === taskId) {
    return true;
  }
  if (!todo.taskId && taskLabel) {
    const target = normalizeLabel(taskLabel);
    if (!target) {
      return false;
    }
    const snapshot = normalizeLabel(todo.titleSnapshot);
    const content = normalizeLabel(todo.content);
    return snapshot === target || content === target;
  }
  return false;
}

export function useStatsMetrics({ start, end, todayKey, taskId, taskLabel, enabled = true }: UseStatsMetricsInput) {
  const rangeDays = getRangeDays(start, end);
  const monthKeys = useMemo(() => getMonthKeysBetween(start, end), [start, end]);
  const { monthlyLogsQuery } = useDailyLogQuery({
    monthKeys,
    monthlyLogsOptions: {
      enabled,
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  const filteredLogs = useMemo(() => {
    const startKey = formatDateInput(start);
    const endKey = formatDateInput(end);
    return monthlyLogsQuery.monthlyLogs.filter((log) => log.dateKey >= startKey && log.dateKey <= endKey);
  }, [end, monthlyLogsQuery.monthlyLogs, start]);

  const detailDateKeys = useMemo(() => filteredLogs.map((log) => log.dateKey), [filteredLogs]);
  const detailQueries = useQueries({
    queries: detailDateKeys.map((dateKey) => ({
      queryKey: statsDailyDetailQueryKey(dateKey),
      queryFn: () => fetchDailyLogByDate(dateKey),
      staleTime: 10 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
      enabled: enabled && Boolean(dateKey),
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    })),
  });

  const detailMap = useMemo(() => {
    const map = new Map<string, Awaited<ReturnType<typeof fetchDailyLogByDate>>>();
    detailQueries.forEach((query, index) => {
      const dateKey = detailDateKeys[index];
      if (dateKey && query.data) {
        map.set(dateKey, query.data);
      }
    });
    return map;
  }, [detailDateKeys, detailQueries]);

  const countStats = useMemo(() => {
    const dailySeries: Array<{
      key: string;
      done: number;
      incomplete: number;
      resumeCount: number;
      doneLabels: string[];
      incompleteLabels: string[];
    }> = [];

    for (let i = 0; i < rangeDays; i += 1) {
      const day = addDays(start, i);
      const key = formatDateInput(day);
      const log = filteredLogs.find((item) => item.dateKey === key);
      const sortedTodos = [...(log?.todos ?? [])]
        .filter((todo) => matchesTask(todo, taskId, taskLabel))
        .sort((a, b) => a.order - b.order);
      const doneLabels = sortedTodos.filter((todo) => todo.done).map((todo) => todo.content);
      const incompleteLabels = sortedTodos.filter((todo) => !todo.done).map((todo) => todo.content);
      const resumeCount = (detailMap.get(key)?.todos ?? [])
        .filter((todo) => matchesTask(todo, taskId, taskLabel))
        .reduce((acc, todo) => acc + Math.max(todo.resumeCount ?? 0, 0), 0);
      dailySeries.push({
        key,
        done: doneLabels.length,
        incomplete: incompleteLabels.length,
        resumeCount,
        doneLabels,
        incompleteLabels,
      });
    }

    const doneTodos = dailySeries.reduce((acc, item) => acc + item.done, 0);
    const incompleteTodos = dailySeries.reduce((acc, item) => acc + item.incomplete, 0);
    const totalTodos = doneTodos + incompleteTodos;

    const monthlyMap = new Map<
      string,
      { done: number; incomplete: number; resumeCount: number; doneLabels: string[]; incompleteLabels: string[] }
    >();
    for (const item of dailySeries) {
      const monthKey = item.key.slice(0, 7);
      const prev = monthlyMap.get(monthKey) ?? {
        done: 0,
        incomplete: 0,
        resumeCount: 0,
        doneLabels: [],
        incompleteLabels: [],
      };
      monthlyMap.set(monthKey, {
        done: prev.done + item.done,
        incomplete: prev.incomplete + item.incomplete,
        resumeCount: prev.resumeCount + item.resumeCount,
        doneLabels: [...prev.doneLabels, ...item.doneLabels],
        incompleteLabels: [...prev.incompleteLabels, ...item.incompleteLabels],
      });
    }

    const monthlySeries = [...monthlyMap.entries()].map(([key, value]) => ({ key, ...value }));
    const totalCount = doneTodos + incompleteTodos;
    const donePercent = clampPercent(totalCount > 0 ? (doneTodos / totalCount) * 100 : 0);
    const incompleteFrequencyMap = new Map<string, number>();
    dailySeries.forEach((item) => {
      item.incompleteLabels.forEach((label) => {
        const key = label.trim();
        if (!key) {
          return;
        }
        incompleteFrequencyMap.set(key, (incompleteFrequencyMap.get(key) ?? 0) + 1);
      });
    });
    const frequentIncompleteTasks = [...incompleteFrequencyMap.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([label, count]) => ({ label, count }));

    return {
      completionRate: totalTodos > 0 ? (doneTodos / totalTodos) * 100 : 0,
      incompleteRate: totalTodos > 0 ? (incompleteTodos / totalTodos) * 100 : 0,
      doneTodos,
      incompleteTodos,
      resumeCount: dailySeries.reduce((acc, item) => acc + item.resumeCount, 0),
      frequentIncompleteTasks,
      donePercent,
      incompletePercent: clampPercent(100 - donePercent),
      dailySeries,
      monthlySeries,
      useMonthlyBar: rangeDays > 90,
    };
  }, [detailMap, filteredLogs, rangeDays, start, taskId, taskLabel]);

  const timeStats = useMemo(() => {
    const dailySeries: Array<{ key: string; focusMin: number; restMin: number }> = [];

    for (let i = 0; i < rangeDays; i += 1) {
      const day = addDays(start, i);
      const key = formatDateInput(day);
      const detail = detailMap.get(key);

      let focusSeconds = 0;
      let restSeconds = taskId ? 0 : Math.max(detail?.restAccumulatedSeconds ?? 0, 0);

      const dayEndMs = parseInputDate(key).getTime() + 24 * 60 * 60 * 1000 - 1;
      for (const todo of detail?.todos?.filter((item) => matchesTask(item, taskId, taskLabel)) ?? []) {
        if (todo.done) {
          focusSeconds += Math.max(todo.actualFocusSeconds ?? 0, 0);
          continue;
        }

        const startedAt = toEpochMillis(todo.startedAt);
        if (!startedAt) {
          continue;
        }
        const pausedAt = toEpochMillis(todo.pausedAt);
        const completedAt = toEpochMillis(todo.completedAt);
        const nowMs = Date.now();
        const tentativeEnd = pausedAt ?? completedAt ?? (key === todayKey ? nowMs : dayEndMs);
        const endMs = Math.min(tentativeEnd, dayEndMs);
        const elapsedSeconds = Math.max(Math.floor((endMs - startedAt) / 1000), 0);
        focusSeconds += elapsedSeconds;
      }

      if (!taskId && detail?.restStartedAt && key === todayKey) {
        const restStartedAtMs = toEpochMillis(detail.restStartedAt);
        if (restStartedAtMs) {
          restSeconds += Math.max(Math.floor((Date.now() - restStartedAtMs) / 1000), 0);
        }
      }

      dailySeries.push({
        key,
        focusMin: Math.floor((focusSeconds * 1000) / 60000),
        restMin: Math.floor((restSeconds * 1000) / 60000),
      });
    }

    const monthlyMap = new Map<string, { focusMin: number; restMin: number }>();
    for (const item of dailySeries) {
      const monthKey = item.key.slice(0, 7);
      const prev = monthlyMap.get(monthKey) ?? { focusMin: 0, restMin: 0 };
      monthlyMap.set(monthKey, {
        focusMin: prev.focusMin + item.focusMin,
        restMin: prev.restMin + item.restMin,
      });
    }

    return {
      totalFocus: dailySeries.reduce((acc, item) => acc + item.focusMin, 0),
      totalRest: dailySeries.reduce((acc, item) => acc + item.restMin, 0),
      dailySeries,
      monthlySeries: [...monthlyMap.entries()].map(([key, value]) => ({ key, ...value })),
      useMonthlyBar: rangeDays > 90,
    };
  }, [detailMap, rangeDays, start, taskId, taskLabel, todayKey]);

  const timeBars: TimeBarDatum[] = timeStats.useMonthlyBar
    ? timeStats.monthlySeries.map((item) => ({ label: item.key.slice(5), tooltipLabel: item.key, ...item }))
    : timeStats.dailySeries.map((item) => ({ label: item.key.slice(5), tooltipLabel: item.key, ...item }));
  const countBars: CountBarDatum[] = countStats.useMonthlyBar
    ? countStats.monthlySeries.map((item) => ({
        label: item.key.slice(5),
        tooltipLabel: item.key,
        done: item.done,
        incomplete: item.incomplete,
        resumeCount: item.resumeCount,
        doneLabels: item.doneLabels,
        incompleteLabels: item.incompleteLabels,
      }))
    : countStats.dailySeries.map((item) => ({
        label: item.key.slice(5),
        tooltipLabel: item.key,
        done: item.done,
        incomplete: item.incomplete,
        resumeCount: item.resumeCount,
        doneLabels: item.doneLabels,
        incompleteLabels: item.incompleteLabels,
      }));

  const activitySignal = useMemo(() => {
    const series: StatsDailyActivityDatum[] = countStats.dailySeries.map((countItem, index) => {
      const timeItem = timeStats.dailySeries[index];
      return {
        key: countItem.key,
        done: countItem.done,
        incomplete: countItem.incomplete,
        resumeCount: countItem.resumeCount,
        focusMin: timeItem?.focusMin ?? 0,
        restMin: timeItem?.restMin ?? 0,
      };
    });

    const hasTodo = (item: (typeof series)[number]) => item.done + item.incomplete > 0;
    const hasFocus = (item: (typeof series)[number]) => item.focusMin > 0;
    const hasIncomplete = (item: (typeof series)[number]) => item.incomplete > 0;
    const isActive = (item: (typeof series)[number]) =>
      hasTodo(item) || item.focusMin > 0 || item.restMin > 0;

    const activeDays = series.filter(isActive);
    const firstActiveDate = activeDays.length > 0 ? activeDays[0]?.key ?? null : null;
    const lastActiveDate = activeDays.length > 0 ? activeDays[activeDays.length - 1]?.key ?? null : null;
    const daysWithTodo = series.filter(hasTodo).length;
    const daysWithFocus = series.filter(hasFocus).length;
    const daysWithIncomplete = series.filter(hasIncomplete).length;
    const activeDayCount = activeDays.length;

    return {
      dailySeries: series,
      activeDayCount,
      daysWithTodo,
      daysWithFocus,
      daysWithIncomplete,
      firstActiveDate,
      lastActiveDate,
      dataCoverageRate: rangeDays > 0 ? (activeDayCount / rangeDays) * 100 : 0,
      avgDonePerActiveDay: activeDayCount > 0 ? countStats.doneTodos / activeDayCount : 0,
      avgIncompletePerActiveDay: activeDayCount > 0 ? countStats.incompleteTodos / activeDayCount : 0,
    };
  }, [countStats.dailySeries, countStats.doneTodos, countStats.incompleteTodos, rangeDays, timeStats.dailySeries]);

  const periodReview = useMemo(() => {
    const combined = countStats.dailySeries.map((countItem, index) => {
      const timeItem = timeStats.dailySeries[index];
      const dayTodos = (detailMap.get(countItem.key)?.todos ?? []).filter((todo) =>
        matchesTask(todo, taskId, taskLabel)
      );
      const startedIncomplete = dayTodos.filter((todo) => {
        if (todo.done) {
          return false;
        }
        const resumed = Math.max(todo.resumeCount ?? 0, 0) > 0;
        const focused = Math.max(todo.actualFocusSeconds ?? 0, 0) > 0;
        return Boolean(todo.startedAt) || resumed || focused;
      }).length;

      const focusMin = timeItem?.focusMin ?? 0;
      const engaged =
        countItem.done > 0 || startedIncomplete > 0 || focusMin > 0 || countItem.resumeCount > 0;

      return {
        key: countItem.key,
        done: countItem.done,
        startedIncomplete,
        resumeCount: countItem.resumeCount,
        focusMin,
        engaged,
      };
    });

    const evaluable = combined.filter((item) => item.engaged);
    const goodDays = evaluable.filter(
      (item) =>
        item.done >= 1 &&
        item.focusMin >= 25 &&
        item.startedIncomplete <= item.done &&
        item.resumeCount <= 2
    ).length;
    const roughDays = evaluable.filter(
      (item) => item.startedIncomplete > item.done || item.resumeCount >= 4
    ).length;

    return {
      startDate: combined[0]?.key ?? null,
      endDate: combined[combined.length - 1]?.key ?? null,
      goodDays,
      roughDays,
      evaluableDays: evaluable.length,
    };
  }, [countStats.dailySeries, detailMap, taskId, taskLabel, timeStats.dailySeries]);

  return {
    count: {
      completionRate: countStats.completionRate,
      incompleteRate: countStats.incompleteRate,
      doneTodos: countStats.doneTodos,
      incompleteTodos: countStats.incompleteTodos,
      resumeCount: countStats.resumeCount,
      frequentIncompleteTasks: countStats.frequentIncompleteTasks,
      useMonthlyBar: countStats.useMonthlyBar,
      donePercent: countStats.donePercent,
      incompletePercent: countStats.incompletePercent,
      data: countBars,
    },
    time: {
      totalFocus: timeStats.totalFocus,
      totalRest: timeStats.totalRest,
      useMonthlyBar: timeStats.useMonthlyBar,
      data: timeBars,
    },
    periodReview,
    signal: activitySignal,
    isFetching:
      monthlyLogsQuery.dailyLogQueries.some((query) => query.isFetching) ||
      detailQueries.some((query) => query.isFetching),
  };
}
