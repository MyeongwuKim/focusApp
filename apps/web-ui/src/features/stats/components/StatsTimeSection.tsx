import { MetricCardGrid } from "./MetricCardGrid";
import { StatsTimeChart } from "./StatsTimeChart";
import type { TimeBarDatum } from "./types";

type StatsTimeSectionProps = {
  totalFocus: number;
  totalRest: number;
  useMonthlyBar: boolean;
  data: TimeBarDatum[];
};

export function StatsTimeSection({
  totalFocus,
  totalRest,
  useMonthlyBar,
  data,
}: StatsTimeSectionProps) {

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/80">세션 시간 (분)</h3>
      <MetricCardGrid
        items={[
          { label: "집중 시간", value: `${totalFocus}분` },
          { label: "휴식 시간", value: `${totalRest}분` },
        ]}
      />

      <StatsTimeChart
        title={useMonthlyBar ? "월별 집중/휴식 시간" : "일별 집중/휴식 시간"}
        data={data}
      />
    </div>
  );
}
