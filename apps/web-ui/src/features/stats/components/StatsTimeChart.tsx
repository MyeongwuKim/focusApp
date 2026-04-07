import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TimeBarDatum } from "./types";

type StatsTimeChartProps = {
  title: string;
  data: TimeBarDatum[];
};

const CHART_FOCUS_COLOR = "var(--color-success, #10b981)";
const CHART_DEVIATION_COLOR = "var(--color-error, #ef4444)";
const CHART_REST_COLOR = "var(--color-info, #0ea5e9)";
const CHART_GRID_COLOR = "color-mix(in oklab, var(--color-base-content, #64748b) 20%, transparent)";
const CHART_TICK_COLOR = "var(--color-base-content, #334155)";

function TimeTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload ?? {};

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-base-content">{entry.tooltipLabel ?? label}</p>
      <p className="text-success">집중 {entry.focusMin ?? 0}분</p>
      <p className="text-error">이탈 {entry.deviationMin ?? 0}분</p>
      <p className="text-info">휴식 {entry.restMin ?? 0}분</p>
    </div>
  );
}

export function StatsTimeChart({ title, data }: StatsTimeChartProps) {
  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} width={24} />
            <Tooltip content={<TimeTooltip />} wrapperStyle={{ zIndex: 80 }} />
            <Legend />
            <Bar dataKey="focusMin" name="집중" stackId="b" fill={CHART_FOCUS_COLOR} radius={[3, 3, 0, 0]} />
            <Bar dataKey="deviationMin" name="이탈" stackId="b" fill={CHART_DEVIATION_COLOR} radius={[3, 3, 0, 0]} />
            <Bar dataKey="restMin" name="휴식" stackId="b" fill={CHART_REST_COLOR} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
