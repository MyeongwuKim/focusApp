import { MetricCardGrid } from "../../stats/components/MetricCardGrid";
import { StatsPeriodFilter } from "../../stats/components/StatsPeriodFilter";
import { StatsTimeChart } from "../../stats/components/StatsTimeChart";
import type { TimeBarDatum } from "../../stats/components/types";

type TaskStatsTrendTabProps = {
  focusMinutes: number;
  resumeCount: number;
  useMonthlyBar: boolean;
  data: TimeBarDatum[];
};

export function TaskStatsTrendTab({
  focusMinutes,
  resumeCount,
  useMonthlyBar,
  data,
}: TaskStatsTrendTabProps) {
  return (
    <>
      <StatsPeriodFilter />
      <MetricCardGrid
        items={[
          { label: "집중 시간", value: `${focusMinutes}분` },
          { label: "재개 횟수", value: `${resumeCount}회` },
        ]}
      />
      <StatsTimeChart title={useMonthlyBar ? "월별 집중/휴식 시간" : "일별 집중/휴식 시간"} data={data} />
    </>
  );
}
