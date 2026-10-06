import { MetricCardGrid } from "../../stats/components/MetricCardGrid";
import { StatsPeriodFilter } from "../../stats/components/StatsPeriodFilter";
import { StatsTimeChart } from "../../stats/components/StatsTimeChart";
import type { TimeBarDatum } from "../../stats/components/types";

type TaskStatsTrendTabProps = {
  focusMinutes: number;
  useMonthlyBar: boolean;
  timeData: TimeBarDatum[];
};

export function TaskStatsTrendTab({
  focusMinutes,
  useMonthlyBar,
  timeData,
}: TaskStatsTrendTabProps) {
  return (
    <>
      <StatsPeriodFilter />
      <MetricCardGrid
        className="grid grid-cols-1"
        items={[
          { label: "집중 시간", value: `${focusMinutes}분` },
        ]}
      />
      <StatsTimeChart
        title={useMonthlyBar ? "월별 집중시간" : "일별 집중시간"}
        data={timeData}
        showRest={false}
      />
    </>
  );
}
