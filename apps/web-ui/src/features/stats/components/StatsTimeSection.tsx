import { StatsMetricCard } from "./StatsMetricCard";
import { StatsTimeChart } from "./StatsTimeChart";
import type { TimeBarDatum } from "./types";

type StatsTimeSectionProps = {
  totalFocus: number;
  totalDeviation: number;
  totalRest: number;
  useMonthlyBar: boolean;
  data: TimeBarDatum[];
};

export function StatsTimeSection({
  totalFocus,
  totalDeviation,
  totalRest,
  useMonthlyBar,
  data,
}: StatsTimeSectionProps) {

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/80">세션 시간 (분)</h3>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <StatsMetricCard label="집중 시간" value={`${totalFocus}분`} />
        <StatsMetricCard label="이탈 시간" value={`${totalDeviation}분`} />
        <StatsMetricCard label="휴식 시간" value={`${totalRest}분`} />
      </div>

      <StatsTimeChart
        title={useMonthlyBar ? "월별 집중/이탈/휴식 시간" : "일별 집중/이탈/휴식 시간"}
        data={data}
      />
    </div>
  );
}
