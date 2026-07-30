import { MetricCardGrid } from "../../stats/components/MetricCardGrid";
import { FocusResumeRelationCard } from "../../stats/components/FocusResumeRelationCard";
import { StatsPeriodFilter } from "../../stats/components/StatsPeriodFilter";
import { StatsTimeChart } from "../../stats/components/StatsTimeChart";
import type { FocusResumeDatum, TimeBarDatum } from "../../stats/components/types";

const RESUME_COUNT_DESCRIPTION = "일시정지 후 다시 시작한 누적 횟수";

type TaskStatsTrendTabProps = {
  focusMinutes: number;
  resumeCount: number;
  taskLabel?: string | null;
  averageResumesPerTask: number | null;
  averageFocusSegmentMinutes: number | null;
  useMonthlyBar: boolean;
  timeData: TimeBarDatum[];
  focusResumeData: FocusResumeDatum[];
};

export function TaskStatsTrendTab({
  focusMinutes,
  resumeCount,
  taskLabel,
  averageResumesPerTask,
  averageFocusSegmentMinutes,
  useMonthlyBar,
  timeData,
  focusResumeData,
}: TaskStatsTrendTabProps) {
  return (
    <>
      <StatsPeriodFilter />
      <MetricCardGrid
        className="grid grid-cols-2 gap-2 md:gap-3"
        items={[
          { label: "집중 시간", value: `${focusMinutes}분` },
          { label: "재개 횟수", value: `${resumeCount}회`, description: RESUME_COUNT_DESCRIPTION },
        ]}
      />
      <StatsTimeChart
        title={useMonthlyBar ? "월별 집중시간" : "일별 집중시간"}
        data={timeData}
        showRest={false}
      />
      <FocusResumeRelationCard
        scope="task"
        taskLabel={taskLabel}
        focusMinutes={focusMinutes}
        resumeCount={resumeCount}
        averageResumesPerTask={averageResumesPerTask}
        averageFocusSegmentMinutes={averageFocusSegmentMinutes}
        useMonthlyBar={useMonthlyBar}
        data={focusResumeData}
      />
    </>
  );
}
