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
  showRest?: boolean;
};

const CHART_GRID_COLOR = "rgba(82, 76, 64, 0.18)";
const CHART_TICK_COLOR = "#575146";

type TimeTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: Partial<TimeBarDatum> }>;
  label?: string | number;
  showRest: boolean;
};

function TimeTooltip({ active, payload, label, showRest }: TimeTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload;
  const totalMinutes = (entry?.focusMin ?? 0) + (entry?.restMin ?? 0);

  return (
    <div className="stats-chart-tooltip rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg">
      <p className="mb-1 font-semibold text-base-content">{entry?.tooltipLabel ?? label}</p>
      <p className="text-success">집중 {entry?.focusMin ?? 0}분</p>
      {showRest ? <p className="text-info">휴식 {entry?.restMin ?? 0}분</p> : null}
      {showRest ? <p className="mt-1 text-base-content/70">총합 {totalMinutes}분</p> : null}
    </div>
  );
}

export function StatsTimeChart({ title, data, showRest = true }: StatsTimeChartProps) {
  return (
    <article className="stats-chart-card rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-3 h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="stats-focus-crayon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#a9c7a7" />
                <stop offset="55%" stopColor="#7fa489" />
                <stop offset="100%" stopColor="#96b69a" />
              </linearGradient>
              <linearGradient id="stats-rest-crayon" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#b8d4df" />
                <stop offset="55%" stopColor="#8eb5c7" />
                <stop offset="100%" stopColor="#a8cad6" />
              </linearGradient>
              <filter id="stats-crayon-rough" x="-4%" y="-4%" width="108%" height="108%">
                <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="2" seed="8" result="crayonNoise" />
                <feDisplacementMap in="SourceGraphic" in2="crayonNoise" scale="1.35" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_COLOR} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: CHART_TICK_COLOR }} width={24} />
            <Tooltip content={<TimeTooltip showRest={showRest} />} wrapperStyle={{ zIndex: 80 }} />
            <Legend />
            <Bar dataKey="focusMin" name="집중" stackId="b" fill="url(#stats-focus-crayon)" radius={[5, 4, 1, 2]} />
            {showRest ? (
              <Bar dataKey="restMin" name="휴식" stackId="b" fill="url(#stats-rest-crayon)" radius={[4, 5, 2, 1]} />
            ) : null}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}
