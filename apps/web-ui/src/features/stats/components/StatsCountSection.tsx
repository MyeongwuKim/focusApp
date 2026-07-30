import { MetricCardGrid } from "./MetricCardGrid";
import { StatsCountChart } from "./StatsCountChart";
import type { CountBarDatum } from "./types";

type StatsCountSectionProps = {
  completionRate: number;
  incompleteRate: number;
  doneTodos: number;
  useMonthlyBar: boolean;
  donePercent: number;
  incompletePercent: number;
  data: CountBarDatum[];
};

export function StatsCountSection({
  completionRate,
  incompleteRate,
  doneTodos,
  useMonthlyBar,
  donePercent,
  incompletePercent,
  data,
}: StatsCountSectionProps) {

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-base-content/80">생산성 (개수)</h3>
      <MetricCardGrid
        className="grid grid-cols-3 gap-2 md:gap-3"
        items={[
          { label: "완료율", value: `${completionRate.toFixed(1)}%` },
          { label: "미완료율", value: `${incompleteRate.toFixed(1)}%` },
          { label: "완료 할일", value: doneTodos },
        ]}
      />

      <StatsCountChart
        title={useMonthlyBar ? "월별 완료/미완료" : "일별 완료/미완료"}
        donePercent={donePercent}
        incompletePercent={incompletePercent}
        data={data}
      />
    </div>
  );
}
