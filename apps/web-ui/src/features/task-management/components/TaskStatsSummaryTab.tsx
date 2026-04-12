import { MetricCardGrid } from "../../stats/components/MetricCardGrid";

type SummaryRow = {
  label: string;
  total: number;
  task: number;
};

type TaskStatsSummaryTabProps = {
  recentFocus: {
    days7: number;
    days30: number;
    year1: number;
  };
  focusRows: SummaryRow[];
  deviationRows: SummaryRow[];
};

export function TaskStatsSummaryTab({ recentFocus, focusRows, deviationRows }: TaskStatsSummaryTabProps) {
  return (
    <>
      <MetricCardGrid
        items={[
          { label: "최근 7일 집중", value: `${recentFocus.days7}분` },
          { label: "최근 30일 집중", value: `${recentFocus.days30}분` },
          { label: "최근 1년 집중", value: `${recentFocus.year1}분` },
        ]}
      />

      <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <h3 className="text-sm font-semibold text-base-content/85">기간별 집중시간</h3>
        <div className="mt-2 space-y-2">
          {focusRows.map((row) => {
            const ratio = row.total > 0 ? (row.task / row.total) * 100 : 0;
            return (
              <div key={row.label} className="rounded-lg border border-base-300/70 bg-base-100/70 px-3 py-2 text-sm">
                <p className="m-0 text-xs text-base-content/60">{row.label}</p>
                <p className="m-0 mt-0.5 text-base text-base-content/90">
                  총 집중 {row.total}분 / 해당 할일 {row.task}분 ({ratio.toFixed(1)}%)
                </p>
              </div>
            );
          })}
        </div>
      </article>

      <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
        <h3 className="text-sm font-semibold text-base-content/85">기간별 이탈시간</h3>
        <div className="mt-2 space-y-2">
          {deviationRows.map((row) => {
            const ratio = row.total > 0 ? (row.task / row.total) * 100 : 0;
            return (
              <div key={row.label} className="rounded-lg border border-base-300/70 bg-base-100/70 px-3 py-2 text-sm">
                <p className="m-0 text-xs text-base-content/60">{row.label}</p>
                <p className="m-0 mt-0.5 text-base text-base-content/90">
                  총 이탈 {row.total}분 / 해당 할일 {row.task}분 ({ratio.toFixed(1)}%)
                </p>
              </div>
            );
          })}
        </div>
      </article>
    </>
  );
}
