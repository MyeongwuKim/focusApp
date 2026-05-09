import { MetricCardGrid } from "../../stats/components/MetricCardGrid";

type SummaryRow = {
  label: string;
  total: number;
  task: number;
};

type TaskStatsSummaryTabProps = {
  taskLabel?: string | null;
  recentFocus: {
    days7: number;
    days30: number;
    year1: number;
  };
  focusRows: SummaryRow[];
};

function formatTaskLabel(taskLabel: string | null | undefined) {
  if (!taskLabel) {
    return "선택 작업";
  }
  return taskLabel.length > 18 ? `${taskLabel.slice(0, 18)}...` : taskLabel;
}

export function TaskStatsSummaryTab({ taskLabel, recentFocus, focusRows }: TaskStatsSummaryTabProps) {
  const taskName = formatTaskLabel(taskLabel);

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
            const ratio = row.total > 0 ? Math.min((row.task / row.total) * 100, 100) : 0;
            return (
              <div key={row.label} className="rounded-lg border border-base-300/70 bg-base-100/70 px-3 py-2">
                <div className="flex items-center justify-between gap-2 text-xs text-base-content/65">
                  <p className="m-0">{row.label}</p>
                  <p className="m-0">총 집중 {row.total}분</p>
                </div>
                <div className="mt-1.5 h-7 overflow-hidden rounded-md bg-base-300/55">
                  <div
                    className="relative flex h-full items-center rounded-md bg-primary px-2 transition-all"
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <div className="mt-1 flex items-center justify-between gap-2 text-xs text-base-content/70">
                  <p className="m-0">{taskName} ({row.task}분)</p>
                  <p className="m-0">
                    총 집중의 <span className="font-semibold text-base-content/90">{ratio.toFixed(1)}%</span>
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </article>
    </>
  );
}
