import { MetricCardGrid } from "./MetricCardGrid";
import { StatsCountChart } from "./StatsCountChart";
import type { CountBarDatum } from "./types";

type StatsCountSectionProps = {
  completionRate: number;
  incompleteRate: number;
  doneTodos: number;
  deviationMinutes: number;
  useMonthlyBar: boolean;
  donePercent: number;
  incompletePercent: number;
  data: CountBarDatum[];
};

export function StatsCountSection({
  completionRate,
  incompleteRate,
  doneTodos,
  deviationMinutes,
  useMonthlyBar,
  donePercent,
  incompletePercent,
  data,
}: StatsCountSectionProps) {

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/80">생산성 (개수)</h3>
      <MetricCardGrid
        className="grid grid-cols-2 gap-2 md:grid-cols-4 md:gap-3"
        items={[
          { label: "완료율", value: `${completionRate.toFixed(1)}%` },
          { label: "미완료율", value: `${incompleteRate.toFixed(1)}%` },
          { label: "완료 할일", value: doneTodos },
          { label: "이탈 시간", value: `${deviationMinutes}분` },
        ]}
      />

      <StatsCountChart
        title={useMonthlyBar ? "월별 완료/미완료 + 이탈시간" : "일별 완료/미완료 + 이탈시간"}
        donePercent={donePercent}
        incompletePercent={incompletePercent}
        data={data}
      />
    </div>
  );
}
