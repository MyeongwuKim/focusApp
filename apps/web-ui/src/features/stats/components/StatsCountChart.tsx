import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CountBarDatum } from "./types";

type StatsCountChartProps = {
  title: string;
  donePercent: number;
  incompletePercent: number;
  data: CountBarDatum[];
};

const CHART_DONE_COLOR = "var(--color-success, #10b981)";
const CHART_INCOMPLETE_COLOR = "var(--color-base-300, #94a3b8)";
const CHART_DEVIATION_COLOR = "var(--color-error, #ef4444)";
const CHART_GRID_COLOR = "color-mix(in oklab, var(--color-base-content, #64748b) 20%, transparent)";
const CHART_TICK_COLOR = "var(--color-base-content, #334155)";

function CountTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload ?? {};
  const doneLabels = (entry.doneLabels ?? []) as string[];
  const incompleteLabels = (entry.incompleteLabels ?? []) as string[];

  return (
    <div className="max-w-[280px] rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-base-content">{entry.tooltipLabel ?? label}</p>
      <p className="text-success">완료 {entry.done ?? 0}개</p>
      <p className="text-warning">미완료 {entry.incomplete ?? 0}개</p>
      <p className="text-error">이탈 {(entry.deviationMin ?? 0)}분</p>
      <div className="mt-2 space-y-1 text-base-content/80">
        <p className="font-medium">완료 todo: {doneLabels.length > 0 ? doneLabels.join(", ") : "없음"}</p>
        <p className="font-medium">미완료 todo: {incompleteLabels.length > 0 ? incompleteLabels.join(", ") : "없음"}</p>
      </div>
    </div>
  );
}

export function StatsCountChart({ title, donePercent, incompletePercent, data }: StatsCountChartProps) {
  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-1 flex gap-2 text-xs">
        <span className="rounded-full bg-success/15 px-2 py-1 text-success">완료 {donePercent.toFixed(1)}%</span>
        <span className="rounded-full bg-base-300 px-2 py-1 text-base-content/75">미완료 {incompletePercent.toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} />
            <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} width={24} />
            <YAxis yAxisId="time" orientation="right" allowDecimals={false} tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} width={32} />
            <Tooltip content={<CountTooltip />} wrapperStyle={{ zIndex: 80 }} />
            <Legend />
            <Bar yAxisId="count" dataKey="done" name="완료" stackId="a" fill={CHART_DONE_COLOR} radius={[3, 3, 0, 0]} />
            <Bar yAxisId="count" dataKey="incomplete" name="미완료" stackId="a" fill={CHART_INCOMPLETE_COLOR} radius={[3, 3, 0, 0]} />
            <Line yAxisId="time" type="monotone" dataKey="deviationMin" name="이탈시간(분)" stroke={CHART_DEVIATION_COLOR} strokeWidth={2} dot={{ r: 2, fill: CHART_DEVIATION_COLOR }} activeDot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
