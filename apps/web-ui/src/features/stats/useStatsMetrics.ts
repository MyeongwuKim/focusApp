import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { fetchDailyLogByDate } from "../../api/dailyLogApi";
import { useDailyLogQuery } from "../../queries";
import { addDays, formatDateInput, getMonthKeysBetween, getRangeDays, parseInputDate } from "./statsDate";
import type { CountBarDatum, TimeBarDatum } from "./components/types";

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

export function useStatsMetrics({ start, end, todayKey, taskId, taskLabel }: UseStatsMetricsInput) {
  const rangeDays = getRangeDays(start, end);
  const monthKeys = useMemo(() => getMonthKeysBetween(start, end), [start, end]);
  const { monthlyLogsQuery } = useDailyLogQuery({ monthKeys });

  const filteredLogs = useMemo(() => {
    const startKey = formatDateInput(start);
    const endKey = formatDateInput(end);
    return monthlyLogsQuery.monthlyLogs.filter((log) => log.dateKey >= startKey && log.dateKey <= endKey);
  }, [end, monthlyLogsQuery.monthlyLogs, start]);

  const detailDateKeys = useMemo(() => filteredLogs.map((log) => log.dateKey), [filteredLogs]);
  const detailQueries = useQueries({
    queries: detailDateKeys.map((dateKey) => ({
      queryKey: ["stats-daily-detail", dateKey],
      queryFn: () => fetchDailyLogByDate(dateKey),
      staleTime: 30 * 1000,
      enabled: Boolean(dateKey),
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
      dailySeries.push({
        key,
        done: doneLabels.length,
        incomplete: incompleteLabels.length,
        doneLabels,
        incompleteLabels,
      });
    }

    const doneTodos = dailySeries.reduce((acc, item) => acc + item.done, 0);
    const incompleteTodos = dailySeries.reduce((acc, item) => acc + item.incomplete, 0);
    const totalTodos = doneTodos + incompleteTodos;

    const monthlyMap = new Map<string, { done: number; incomplete: number; doneLabels: string[]; incompleteLabels: string[] }>();
    for (const item of dailySeries) {
      const monthKey = item.key.slice(0, 7);
      const prev = monthlyMap.get(monthKey) ?? { done: 0, incomplete: 0, doneLabels: [], incompleteLabels: [] };
      monthlyMap.set(monthKey, {
        done: prev.done + item.done,
        incomplete: prev.incomplete + item.incomplete,
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
      frequentIncompleteTasks,
      donePercent,
      incompletePercent: clampPercent(100 - donePercent),
      dailySeries,
      monthlySeries,
      useMonthlyBar: rangeDays > 90,
    };
  }, [filteredLogs, rangeDays, start, taskId, taskLabel]);

  const timeStats = useMemo(() => {
    const dailySeries: Array<{ key: string; focusMin: number; deviationMin: number; restMin: number }> = [];

    for (let i = 0; i < rangeDays; i += 1) {
      const day = addDays(start, i);
      const key = formatDateInput(day);
      const detail = detailMap.get(key);

      let focusSeconds = 0;
      let deviationSeconds = 0;
      let restSeconds = taskId ? 0 : Math.max(detail?.restAccumulatedSeconds ?? 0, 0);

      const dayEndMs = parseInputDate(key).getTime() + 24 * 60 * 60 * 1000 - 1;
      for (const todo of detail?.todos?.filter((item) => matchesTask(item, taskId, taskLabel)) ?? []) {
        deviationSeconds += Math.max(todo.deviationSeconds ?? 0, 0);

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
        focusSeconds += Math.max(elapsedSeconds - Math.max(todo.deviationSeconds ?? 0, 0), 0);
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
        deviationMin: Math.floor((deviationSeconds * 1000) / 60000),
        restMin: Math.floor((restSeconds * 1000) / 60000),
      });
    }

    const monthlyMap = new Map<string, { focusMin: number; deviationMin: number; restMin: number }>();
    for (const item of dailySeries) {
      const monthKey = item.key.slice(0, 7);
      const prev = monthlyMap.get(monthKey) ?? { focusMin: 0, deviationMin: 0, restMin: 0 };
      monthlyMap.set(monthKey, {
        focusMin: prev.focusMin + item.focusMin,
        deviationMin: prev.deviationMin + item.deviationMin,
        restMin: prev.restMin + item.restMin,
      });
    }

    return {
      totalFocus: dailySeries.reduce((acc, item) => acc + item.focusMin, 0),
      totalDeviation: dailySeries.reduce((acc, item) => acc + item.deviationMin, 0),
      totalRest: dailySeries.reduce((acc, item) => acc + item.restMin, 0),
      dailySeries,
      monthlySeries: [...monthlyMap.entries()].map(([key, value]) => ({ key, ...value })),
      useMonthlyBar: rangeDays > 90,
    };
  }, [detailMap, rangeDays, start, taskId, taskLabel, todayKey]);

  const timeBars: TimeBarDatum[] = timeStats.useMonthlyBar
    ? timeStats.monthlySeries.map((item) => ({ label: item.key.slice(5), tooltipLabel: item.key, ...item }))
    : timeStats.dailySeries.map((item) => ({ label: item.key.slice(5), tooltipLabel: item.key, ...item }));

  const timeByKey = new Map(timeBars.map((item) => [item.tooltipLabel, item]));
  const countBars: CountBarDatum[] = countStats.useMonthlyBar
    ? countStats.monthlySeries.map((item) => ({
        label: item.key.slice(5),
        tooltipLabel: item.key,
        done: item.done,
        incomplete: item.incomplete,
        deviationMin: timeByKey.get(item.key)?.deviationMin ?? 0,
        doneLabels: item.doneLabels,
        incompleteLabels: item.incompleteLabels,
      }))
    : countStats.dailySeries.map((item) => ({
        label: item.key.slice(5),
        tooltipLabel: item.key,
        done: item.done,
        incomplete: item.incomplete,
        deviationMin: timeByKey.get(item.key)?.deviationMin ?? 0,
        doneLabels: item.doneLabels,
        incompleteLabels: item.incompleteLabels,
      }));

  return {
    count: {
      completionRate: countStats.completionRate,
      incompleteRate: countStats.incompleteRate,
      doneTodos: countStats.doneTodos,
      incompleteTodos: countStats.incompleteTodos,
      frequentIncompleteTasks: countStats.frequentIncompleteTasks,
      deviationMinutes: timeStats.totalDeviation,
      useMonthlyBar: countStats.useMonthlyBar,
      donePercent: countStats.donePercent,
      incompletePercent: countStats.incompletePercent,
      data: countBars,
    },
    time: {
      totalFocus: timeStats.totalFocus,
      totalDeviation: timeStats.totalDeviation,
      totalRest: timeStats.totalRest,
      useMonthlyBar: timeStats.useMonthlyBar,
      data: timeBars,
    },
    deviationRate:
      timeStats.totalFocus + timeStats.totalDeviation > 0
        ? (timeStats.totalDeviation / (timeStats.totalFocus + timeStats.totalDeviation)) * 100
        : 0,
    isFetching:
      monthlyLogsQuery.dailyLogQueries.some((query) => query.isFetching) ||
      detailQueries.some((query) => query.isFetching),
  };
}
