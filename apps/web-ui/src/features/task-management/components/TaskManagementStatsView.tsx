import { useMemo, useState } from "react";
import { FiArrowLeft } from "react-icons/fi";
import { useSearchParams } from "react-router-dom";
import { SegmentedToggle } from "../../../components/SegmentedToggle";
import { Button } from "../../../components/ui/Button";
import { formatDateInput, getPresetRange, normalizeStatsSearchParams } from "../../stats/statsDate";
import { useStatsMetrics } from "../../stats/useStatsMetrics";
import { useTaskCollectionQuery } from "../../../queries";
import { useAppNavigation } from "../../../providers/AppNavigationProvider";
import { TaskStatsSummaryTab } from "./TaskStatsSummaryTab";
import { TaskStatsTrendTab } from "./TaskStatsTrendTab";

function findTaskTitle(
  collections: Array<{ tasks: Array<{ id: string; title: string }> }> | undefined,
  taskId: string
) {
  if (!collections) {
    return null;
  }
  for (const collection of collections) {
    const matched = collection.tasks.find((task) => task.id === taskId);
    if (matched) {
      return matched.title;
    }
  }
  return null;
}

export function TaskManagementStatsView() {
  const { goBack, goPage } = useAppNavigation();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<"summary" | "trend">("summary");
  const normalized = useMemo(() => normalizeStatsSearchParams(searchParams), [searchParams]);
  const taskId = searchParams.get("taskId")?.trim() ?? "";
  const fallbackTaskLabel = searchParams.get("taskLabel")?.trim() || null;
  const { taskCollectionsQuery } = useTaskCollectionQuery();
  const taskLabel = useMemo(() => {
    if (!taskId) {
      return null;
    }
    return findTaskTitle(taskCollectionsQuery.data, taskId) ?? fallbackTaskLabel;
  }, [fallbackTaskLabel, taskCollectionsQuery.data, taskId]);

  const range7 = getPresetRange("7d");
  const range30 = getPresetRange("30d");
  const range1y = getPresetRange("1y");
  const todayKey = formatDateInput(range7.end);

  const all7 = useStatsMetrics({ start: range7.start, end: range7.end, todayKey });
  const all30 = useStatsMetrics({ start: range30.start, end: range30.end, todayKey });
  const all1y = useStatsMetrics({ start: range1y.start, end: range1y.end, todayKey });

  const task7 = useStatsMetrics({
    start: range7.start,
    end: range7.end,
    todayKey,
    taskId: taskId || undefined,
    taskLabel: taskLabel ?? undefined,
  });
  const task30 = useStatsMetrics({
    start: range30.start,
    end: range30.end,
    todayKey,
    taskId: taskId || undefined,
    taskLabel: taskLabel ?? undefined,
  });
  const task1y = useStatsMetrics({
    start: range1y.start,
    end: range1y.end,
    todayKey,
    taskId: taskId || undefined,
    taskLabel: taskLabel ?? undefined,
  });
  const trendTask = useStatsMetrics({
    start: normalized.start,
    end: normalized.end,
    todayKey: normalized.todayKey,
    taskId: taskId || undefined,
    taskLabel: taskLabel ?? undefined,
  });
  const isFetching =
    all7.isFetching ||
    all30.isFetching ||
    all1y.isFetching ||
    task7.isFetching ||
    task30.isFetching ||
    task1y.isFetching ||
    trendTask.isFetching;

  const focusRows = [
    { label: "7일", total: all7.time.totalFocus, task: task7.time.totalFocus },
    { label: "30일", total: all30.time.totalFocus, task: task30.time.totalFocus },
    { label: "1년", total: all1y.time.totalFocus, task: task1y.time.totalFocus },
  ];

  const deviationRows = [
    { label: "7일", total: all7.time.totalDeviation, task: task7.time.totalDeviation },
    { label: "30일", total: all30.time.totalDeviation, task: task30.time.totalDeviation },
    { label: "1년", total: all1y.time.totalDeviation, task: task1y.time.totalDeviation },
  ];

  const closeStats = () => {
    const historyState = window.history.state as { idx?: number } | null;
    const stackIndex = typeof historyState?.idx === "number" ? historyState.idx : 0;

    if (stackIndex > 0) {
      goBack();
      return;
    }

    goPage("/tasks", { replace: true });
  };

  return (
    <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-base-300 bg-base-100/80 p-4 md:p-5">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs text-base-content/55">선택 할일 통계</p>
            <h2 className="text-base font-semibold text-base-content">
              {taskLabel ?? "할일을 찾을 수 없어요."}
            </h2>
          </div>
          <Button size="sm" variant="ghost" className="gap-1" onClick={closeStats}>
            <FiArrowLeft size={14} />
            목록
          </Button>
        </div>

        {!taskId ? (
          <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-4 text-sm text-base-content/70">
            통계를 볼 할일을 먼저 선택해주세요.
          </article>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <SegmentedToggle
                value={tab}
                size="sm"
                options={[
                  { value: "summary", label: "요약" },
                  { value: "trend", label: "추이" },
                ]}
                onChange={setTab}
              />
            </div>

            {tab === "summary" ? (
              <TaskStatsSummaryTab
                recentFocus={{
                  days7: task7.time.totalFocus,
                  days30: task30.time.totalFocus,
                  year1: task1y.time.totalFocus,
                }}
                focusRows={focusRows}
                deviationRows={deviationRows}
              />
            ) : (
              <TaskStatsTrendTab
                focusMinutes={trendTask.time.totalFocus}
                deviationMinutes={trendTask.time.totalDeviation}
                deviationRate={trendTask.deviationRate}
                useMonthlyBar={trendTask.time.useMonthlyBar}
                data={trendTask.time.data}
              />
            )}
          </>
        )}
        {isFetching ? <p className="text-xs text-base-content/60">통계 데이터 불러오는 중...</p> : null}
      </div>
    </section>
  );
}
