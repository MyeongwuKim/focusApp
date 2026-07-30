import { useId, useMemo } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { FocusResumeDatum } from "./types";

type FocusRhythmTrendChartProps = {
  data: FocusResumeDatum[];
  granularity: "day" | "month";
};

type FocusRhythmTrendDatum = {
  key: string;
  label: string;
  tooltipLabel: string;
  focusMinutes: number;
  resumeCount: number;
  recordCount: number;
  averageFocusSegmentMinutes: number;
};

type FocusRhythmTooltipProps = {
  active?: boolean;
  payload?: Array<{ payload?: Partial<FocusRhythmTrendDatum> }>;
};

const CHART_LINE_COLOR = "var(--color-success, #10b981)";
const CHART_GRID_COLOR =
  "color-mix(in oklab, var(--color-base-content, #64748b) 20%, transparent)";
const CHART_TICK_COLOR = "var(--color-base-content, #334155)";

function formatMinutes(value: number) {
  return `${Math.round(value)}분`;
}

function formatLabel(key: string, granularity: FocusRhythmTrendChartProps["granularity"]) {
  if (granularity === "month") {
    return `${key.slice(5)}월`;
  }
  return key.slice(5).replace("-", ".");
}

function buildFocusRhythmTrend(
  data: FocusResumeDatum[],
  granularity: FocusRhythmTrendChartProps["granularity"]
) {
  const groupedMap = new Map<
    string,
    Pick<
      FocusRhythmTrendDatum,
      "key" | "focusMinutes" | "resumeCount" | "recordCount"
    >
  >();

  data.forEach((item) => {
    const key = granularity === "month" ? item.dateKey.slice(0, 7) : item.dateKey;
    const previous = groupedMap.get(key) ?? {
      key,
      focusMinutes: 0,
      resumeCount: 0,
      recordCount: 0,
    };
    groupedMap.set(key, {
      key,
      focusMinutes: previous.focusMinutes + Math.max(item.focusMin, 0),
      resumeCount: previous.resumeCount + Math.max(item.resumeCount, 0),
      recordCount: previous.recordCount + 1,
    });
  });

  return [...groupedMap.values()]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((item): FocusRhythmTrendDatum => {
      const segmentCount = item.recordCount + item.resumeCount;
      return {
        ...item,
        label: formatLabel(item.key, granularity),
        tooltipLabel: granularity === "month" ? `${item.key}월` : item.key,
        averageFocusSegmentMinutes:
          segmentCount > 0 ? item.focusMinutes / segmentCount : 0,
      };
    });
}

function FocusRhythmTooltip({ active, payload }: FocusRhythmTooltipProps) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const entry = payload[0]?.payload;

  return (
    <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-lg">
      <p className="m-0 font-semibold text-base-content">{entry?.tooltipLabel ?? "-"}</p>
      <p className="m-0 mt-1 text-success">
        평균 집중 구간 {formatMinutes(entry?.averageFocusSegmentMinutes ?? 0)}
      </p>
      <p className="m-0 text-base-content/65">
        총 집중 {formatMinutes(entry?.focusMinutes ?? 0)} · 재개 {entry?.resumeCount ?? 0}회
      </p>
      <p className="m-0 text-base-content/55">집중 기록 {entry?.recordCount ?? 0}개</p>
    </div>
  );
}

export function FocusRhythmTrendChart({
  data,
  granularity,
}: FocusRhythmTrendChartProps) {
  const titleId = useId();
  const trendData = useMemo(
    () => buildFocusRhythmTrend(data, granularity),
    [data, granularity]
  );
  const periodLabel = granularity === "month" ? "월별" : "날짜별";

  return (
    <section className="mt-4" aria-labelledby={titleId}>
      <div>
        <h4 id={titleId} className="m-0 text-xs font-medium text-base-content/75">
          {periodLabel} 집중 리듬
        </h4>
        <p className="m-0 mt-0.5 text-[10px] text-base-content/50">
          같은 날짜의 평균 집중 구간과 재개 횟수를 함께 비교해요.
        </p>
      </div>

      {trendData.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
            <span className="inline-flex items-center gap-1 text-success">
              <span className="h-2.5 w-3 rounded-sm bg-success/75" />
              평균 집중 구간 · 왼쪽 축
            </span>
            <span className="inline-flex items-center gap-1 text-primary">
              <span className="w-4 border-t-2 border-primary" />
              재개 횟수 · 오른쪽 축
            </span>
          </div>

          <div
            role="img"
            aria-label={`${periodLabel} 평균 집중 구간과 재개 횟수 혼합 그래프`}
            className="mt-1 h-60"
          >
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={trendData}
                margin={{ top: 10, right: 2, left: 0, bottom: 0 }}
              >
                <CartesianGrid
                  vertical={false}
                  stroke={CHART_GRID_COLOR}
                  strokeDasharray="3 3"
                />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: CHART_TICK_COLOR }}
                  tickLine={false}
                  axisLine={{ stroke: CHART_GRID_COLOR }}
                  minTickGap={18}
                />
                <YAxis
                  yAxisId="focus"
                  unit="분"
                  allowDecimals={false}
                  width={42}
                  domain={[0, "dataMax + 5"]}
                  tick={{ fontSize: 10, fill: CHART_LINE_COLOR }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  yAxisId="resume"
                  orientation="right"
                  unit="회"
                  allowDecimals={false}
                  width={38}
                  domain={[0, "dataMax + 1"]}
                  tick={{ fontSize: 10, fill: "var(--color-primary, #e11d48)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: CHART_GRID_COLOR }}
                  content={<FocusRhythmTooltip />}
                  wrapperStyle={{ zIndex: 80 }}
                />
                <Bar
                  yAxisId="focus"
                  dataKey="averageFocusSegmentMinutes"
                  name="평균 집중 구간"
                  fill={CHART_LINE_COLOR}
                  fillOpacity={0.72}
                  radius={[4, 4, 0, 0]}
                  maxBarSize={28}
                />
                <Line
                  yAxisId="resume"
                  type="linear"
                  dataKey="resumeCount"
                  name="재개 횟수"
                  stroke="var(--color-primary, #e11d48)"
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: "var(--color-primary, #e11d48)",
                    strokeWidth: 0,
                  }}
                  activeDot={{
                    r: 5,
                    fill: "var(--color-primary, #e11d48)",
                    strokeWidth: 2,
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <ul className="sr-only">
            {trendData.map((item) => (
              <li key={item.key}>
                {item.label} 평균 집중 구간{" "}
                {formatMinutes(item.averageFocusSegmentMinutes)} · 집중 기록{" "}
                {item.recordCount}개 · 총 집중 {formatMinutes(item.focusMinutes)} · 재개{" "}
                {item.resumeCount}회
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="mt-2 flex h-24 items-center justify-center rounded-lg border border-dashed border-base-300 text-xs text-base-content/55">
          집중을 시작한 할 일이 아직 없어요.
        </div>
      )}
    </section>
  );
}
