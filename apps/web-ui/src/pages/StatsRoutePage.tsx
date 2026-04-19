import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { StatsCommentaryPayload } from "../api/statsCommentaryApi";
import { StatsAiCommentaryCard } from "../features/stats/components/StatsAiCommentaryCard";
import { StatsCountSection } from "../features/stats/components/StatsCountSection";
import { StatsPeriodFilter } from "../features/stats/components/StatsPeriodFilter";
import { StatsTimeSection } from "../features/stats/components/StatsTimeSection";
import { getRangeDays, normalizeStatsSearchParams } from "../features/stats/statsDate";
import { useStatsMetrics } from "../features/stats/useStatsMetrics";

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
  const { count, time, isFetching } = useStatsMetrics({
    start: normalized.start,
    end: normalized.end,
    todayKey: normalized.todayKey,
  });
  const canUseAiCommentary =
    count.doneTodos + count.incompleteTodos + time.totalFocus + time.totalDeviation + time.totalRest > 0;
  const periodDays = getRangeDays(normalized.start, normalized.end);

  const commentaryPayload = useMemo<StatsCommentaryPayload>(
    () => ({
      period: {
        preset: normalized.preset,
        start: normalized.startInput,
        end: normalized.endInput,
        days: periodDays,
      },
      totals: {
        doneCount: count.doneTodos,
        incompleteCount: count.incompleteTodos,
        focusMinutes: time.totalFocus,
        deviationMinutes: time.totalDeviation,
        restMinutes: time.totalRest,
      },
      rates: {
        completionRate: count.completionRate,
        incompleteRate: count.incompleteRate,
      },
      frequentIncompleteTasks: count.frequentIncompleteTasks,
    }),
    [
      count.completionRate,
      count.doneTodos,
      count.frequentIncompleteTasks,
      count.incompleteRate,
      count.incompleteTodos,
      normalized.endInput,
      normalized.preset,
      normalized.startInput,
      periodDays,
      time.totalDeviation,
      time.totalFocus,
      time.totalRest,
    ]
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
        <StatsCountSection
          completionRate={count.completionRate}
          incompleteRate={count.incompleteRate}
          doneTodos={count.doneTodos}
          deviationMinutes={count.deviationMinutes}
          useMonthlyBar={count.useMonthlyBar}
          donePercent={count.donePercent}
          incompletePercent={count.incompletePercent}
          data={count.data}
        />
        <StatsTimeSection
          totalFocus={time.totalFocus}
          totalDeviation={time.totalDeviation}
          totalRest={time.totalRest}
          useMonthlyBar={time.useMonthlyBar}
          data={time.data}
        />
        <StatsAiCommentaryCard
          payload={commentaryPayload}
          isDataFetching={isFetching}
          canUseCommentary={canUseAiCommentary}
        />
        {isFetching ? <p className="text-xs text-base-content/60">통계 데이터 불러오는 중...</p> : null}
      </div>

      <div className="mt-4 text-xs text-base-content/55">
        미완료: 선택 기간 내 미완료(todo done=false) 합계
      </div>
      <div className="mt-1 text-xs text-base-content/55">이탈: 집중 세션 중 기록된 이탈 시간(분)</div>
    </section>
  );
}
