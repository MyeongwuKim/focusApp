import { useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { StatsAiCommentaryCard } from "../features/stats/components/StatsAiCommentaryCard";
import { StatsCrayonTimeline } from "../features/stats/components/StatsCrayonTimeline";
import { StatsHighlights } from "../features/stats/components/StatsHighlights";
import { StatsMonthlyOverview } from "../features/stats/components/StatsMonthlyOverview";
import { StatsPeriodFilter } from "../features/stats/components/StatsPeriodFilter";
import { StatsSummaryNote } from "../features/stats/components/StatsSummaryNote";
import { normalizeStatsSearchParams } from "../features/stats/statsDate";
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
  const { count, time, signal, isFetching } = useStatsMetrics({
    start: normalized.start,
    end: normalized.end,
    todayKey: normalized.todayKey,
  });
  const rangeDays = Math.floor(
    (normalized.end.getTime() - normalized.start.getTime()) / (24 * 60 * 60 * 1000)
  ) + 1;
  const aiCommentaryPayload = useMemo(
    () => ({
      period: {
        preset: normalized.preset,
        start: normalized.startInput,
        end: normalized.endInput,
        days: rangeDays,
      },
      totals: {
        doneCount: count.doneTodos,
        incompleteCount: count.incompleteTodos,
        focusMinutes: time.totalFocus,
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
    [count, normalized.endInput, normalized.preset, normalized.startInput, rangeDays, signal, time]
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
    <section className="sketchbook-stats-page min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5">
      <div className="stats-journal space-y-5">
        <StatsPeriodFilter />
        <StatsSummaryNote
          doneCount={count.doneTodos}
          incompleteCount={count.incompleteTodos}
          focusMinutes={time.totalFocus}
          activeDays={signal.activeDayCount}
          rangeDays={rangeDays}
          periodLabel={normalized.preset === "1y" ? "최근 12개월 기록" : undefined}
        />
        {count.useMonthlyBar ? (
          <StatsMonthlyOverview countData={count.data} timeData={time.data} />
        ) : (
          <StatsCrayonTimeline countData={count.data} timeData={time.data} />
        )}
        <StatsHighlights
          countData={count.data}
          timeData={time.data}
          activeDays={signal.activeDayCount}
          averageDonePerActiveDay={signal.avgDonePerActiveDay}
          frequentIncompleteTasks={count.frequentIncompleteTasks}
        />
        <StatsAiCommentaryCard
          payload={aiCommentaryPayload}
          isDataFetching={isFetching}
          canUseCommentary={signal.activeDayCount > 0}
        />
        {isFetching ? <p className="text-xs text-base-content/60">통계 데이터 불러오는 중...</p> : null}
      </div>
    </section>
  );
}
