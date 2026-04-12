import { MetricCardGrid } from "../../stats/components/MetricCardGrid";
import { StatsPeriodFilter } from "../../stats/components/StatsPeriodFilter";
import { StatsTimeChart } from "../../stats/components/StatsTimeChart";
import type { TimeBarDatum } from "../../stats/components/types";

type TaskStatsTrendTabProps = {
  focusMinutes: number;
  deviationMinutes: number;
  deviationRate: number;
  useMonthlyBar: boolean;
  data: TimeBarDatum[];
};

export function TaskStatsTrendTab({
  focusMinutes,
  deviationMinutes,
  deviationRate,
  useMonthlyBar,
  data,
}: TaskStatsTrendTabProps) {
  return (
    <>
      <StatsPeriodFilter />
      <MetricCardGrid
        items={[
          { label: "집중 시간", value: `${focusMinutes}분` },
          { label: "이탈 시간", value: `${deviationMinutes}분` },
          { label: "이탈율", value: `${deviationRate.toFixed(1)}%` },
        ]}
      />
      <StatsTimeChart title={useMonthlyBar ? "월별 집중/이탈 시간" : "일별 집중/이탈 시간"} data={data} showRest={false} />
    </>
  );
}
