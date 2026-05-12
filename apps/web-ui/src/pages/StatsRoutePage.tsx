import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { StatsAiCommentaryCard } from "../features/stats/components/StatsAiCommentaryCard";
import { StatsCountSection } from "../features/stats/components/StatsCountSection";
import { MetricCardGrid } from "../features/stats/components/MetricCardGrid";
import { StatsPeriodFilter } from "../features/stats/components/StatsPeriodFilter";
import { StatsTimeSection } from "../features/stats/components/StatsTimeSection";
import { StatsWeeklyReviewCard } from "../features/stats/components/StatsWeeklyReviewCard";
import { normalizeStatsSearchParams } from "../features/stats/statsDate";
import { useStatsMetrics } from "../features/stats/useStatsMetrics";
import { useDailyLogQuery } from "../queries";

type StatsRoutePageProps = {
  forcedSearch?: string;
};

export function StatsRoutePage({ forcedSearch }: StatsRoutePageProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const effectiveSearchParams = useMemo(
    () => (forcedSearch !== undefined ? new URLSearchParams(forcedSearch) : searchParams),
    [forcedSearch, searchParams]
  );
  const normalized = useMemo(
    () => normalizeStatsSearchParams(effectiveSearchParams),
    [effectiveSearchParams]
  );
  const { count, time, periodReview, signal, isFetching } = useStatsMetrics({
    start: normalized.start,
    end: normalized.end,
    todayKey: normalized.todayKey,
  });
  const { dailyLogByDateQuery } = useDailyLogQuery({ dateKey: normalized.todayKey });
  const todayKpi = useMemo(() => {
    const todos = dailyLogByDateQuery.data?.todos ?? [];
    const doneCount = todos.filter((todo) => todo.done).length;
    const focusMinutes = Math.floor(
      todos.reduce((acc, todo) => acc + Math.max(todo.actualFocusSeconds ?? 0, 0), 0) / 60
    );
    const restAccumulatedSeconds = Math.max(dailyLogByDateQuery.data?.restAccumulatedSeconds ?? 0, 0);
    const restStartedAt = dailyLogByDateQuery.data?.restStartedAt
      ? new Date(dailyLogByDateQuery.data.restStartedAt).getTime()
      : null;
    const activeRestSeconds =
      restStartedAt && Number.isFinite(restStartedAt)
        ? Math.max(Math.floor((Date.now() - restStartedAt) / 1000), 0)
        : 0;
    return {
      doneCount,
      focusMinutes,
      restMinutes: Math.floor((restAccumulatedSeconds + activeRestSeconds) / 60),
    };
  }, [dailyLogByDateQuery.data]);
  const aiCommentaryPayload = useMemo(
    () => ({
      period: {
        preset: normalized.preset,
        start: normalized.startInput,
        end: normalized.endInput,
        days:
          Math.floor((normalized.end.getTime() - normalized.start.getTime()) / (24 * 60 * 60 * 1000)) + 1,
      },
      totals: {
        doneCount: count.doneTodos,
        incompleteCount: count.incompleteTodos,
        focusMinutes: time.totalFocus,
        resumeCount: count.resumeCount,
        restMinutes: time.totalRest,
      },
      rates: {
        completionRate: count.completionRate,
        incompleteRate: count.incompleteRate,
      },
      frequentIncompleteTasks: count.frequentIncompleteTasks,
      meta: {
        activeDays: signal.activeDayCount,
        daysWithTodos: signal.daysWithTodo,
        daysWithFocus: signal.daysWithFocus,
        daysWithIncomplete: signal.daysWithIncomplete,
        firstActiveDate: signal.firstActiveDate,
        lastActiveDate: signal.lastActiveDate,
        dataCoverageRate: signal.dataCoverageRate,
        avgDonePerActiveDay: signal.avgDonePerActiveDay,
        avgIncompletePerActiveDay: signal.avgIncompletePerActiveDay,
      },
    }),
    [count, normalized.end, normalized.endInput, normalized.preset, normalized.start, normalized.startInput, signal, time]
  );

  useEffect(() => {
    if (forcedSearch !== undefined) {
      return;
    }
    const next = normalized.normalized.toString();
    if (searchParams.toString() !== next) {
      setSearchParams(normalized.normalized, { replace: true });
    }
  }, [forcedSearch, normalized.normalized, searchParams, setSearchParams]);

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5">
      <div className="space-y-5">
        <StatsPeriodFilter />
        <MetricCardGrid
          className="grid grid-cols-1 gap-2 md:grid-cols-3 md:gap-3"
          items={[
            { label: "오늘 한 일", value: `${todayKpi.doneCount}개` },
            { label: "집중 분", value: `${todayKpi.focusMinutes}분` },
            { label: "휴식 분", value: `${todayKpi.restMinutes}분` },
          ]}
        />
        {periodReview.startDate && periodReview.endDate ? (
          <StatsWeeklyReviewCard
            startDate={periodReview.startDate}
            endDate={periodReview.endDate}
            goodDays={periodReview.goodDays}
            roughDays={periodReview.roughDays}
            evaluableDays={periodReview.evaluableDays}
          />
        ) : null}
        <StatsCountSection
          completionRate={count.completionRate}
          incompleteRate={count.incompleteRate}
          doneTodos={count.doneTodos}
          resumeCount={count.resumeCount}
          useMonthlyBar={count.useMonthlyBar}
          donePercent={count.donePercent}
          incompletePercent={count.incompletePercent}
          data={count.data}
        />
        <StatsTimeSection
          totalFocus={time.totalFocus}
          totalRest={time.totalRest}
          useMonthlyBar={time.useMonthlyBar}
          data={time.data}
        />
        <StatsAiCommentaryCard
          payload={aiCommentaryPayload}
          isDataFetching={isFetching}
          canUseCommentary={signal.activeDayCount > 0}
        />
        {isFetching ? <p className="text-xs text-base-content/60">통계 데이터 불러오는 중...</p> : null}
      </div>

      <div className="mt-4 text-xs text-base-content/55">
        미완료: 선택 기간 내 미완료(todo done=false) 합계
      </div>
    </section>
  );
}
