import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
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

const CHART_GRID_COLOR = "rgba(82, 76, 64, 0.18)";
const CHART_TICK_COLOR = "#575146";

type CountTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: Partial<CountBarDatum> }>;
  label?: string | number;
};

function CountTooltip({ active, payload, label }: CountTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload;
  const doneLabels = entry?.doneLabels ?? [];
  const incompleteLabels = entry?.incompleteLabels ?? [];

  return (
    <div className="stats-chart-tooltip max-w-[280px] rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-base-content">{entry?.tooltipLabel ?? label}</p>
      <p className="text-success">완료 {entry?.done ?? 0}개</p>
      <p className="text-warning">미완료 {entry?.incomplete ?? 0}개</p>
      <div className="mt-2 space-y-1 text-base-content/80">
        <p className="font-medium">완료 todo: {doneLabels.length > 0 ? doneLabels.join(", ") : "없음"}</p>
        <p className="font-medium">미완료 todo: {incompleteLabels.length > 0 ? incompleteLabels.join(", ") : "없음"}</p>
      </div>
    </div>
  );
}

export function StatsCountChart({ title, donePercent, incompletePercent, data }: StatsCountChartProps) {
  return (
    <article className="stats-chart-card rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-1 flex gap-2 text-xs">
        <span className="rounded-full bg-success/15 px-2 py-1 text-success">완료 {donePercent.toFixed(1)}%</span>
        <span className="rounded-full bg-base-300 px-2 py-1 text-base-content/75">미완료 {incompletePercent.toFixed(1)}%</span>
      </div>
      <div className="mt-3 h-52">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 6, right: 12, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="stats-done-crayon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b3cda9" />
                <stop offset="58%" stopColor="#82aa88" />
                <stop offset="100%" stopColor="#9cbd9a" />
              </linearGradient>
              <linearGradient id="stats-incomplete-crayon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#efc0ae" />
                <stop offset="55%" stopColor="#d99882" />
                <stop offset="100%" stopColor="#e7ad99" />
              </linearGradient>
              <filter id="stats-crayon-rough" x="-4%" y="-4%" width="108%" height="108%">
                <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="8" result="crayonNoise" />
                <feDisplacementMap in="SourceGraphic" in2="crayonNoise" scale="1.35" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} />
            <YAxis yAxisId="count" allowDecimals={false} tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} width={24} />
            <Tooltip content={<CountTooltip />} wrapperStyle={{ zIndex: 80 }} />
            <Legend />
            <Bar yAxisId="count" dataKey="done" name="완료" stackId="a" fill="url(#stats-done-crayon)" radius={[5, 4, 1, 2]} />
            <Bar yAxisId="count" dataKey="incomplete" name="미완료" stackId="a" fill="url(#stats-incomplete-crayon)" radius={[4, 5, 2, 1]} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
