const exampleData = [
  { x: 72, label: "05.08", focusY: 91, resumeY: 124 },
  { x: 138, label: "05.12", focusY: 66, resumeY: 96 },
  { x: 204, label: "05.18", focusY: 80, resumeY: 68 },
  { x: 270, label: "05.24", focusY: 40, resumeY: 40 },
];

export function FocusRhythmHelpVisual() {
  return (
    <section aria-labelledby="focus-rhythm-help-heading">
      <h3
        id="focus-rhythm-help-heading"
        className="m-0 text-sm font-semibold text-base-content/85"
      >
        혼합 그래프 읽는 법
      </h3>
      <p className="m-0 mt-1 text-xs leading-5 text-base-content/70">
        초록 막대는 한 번에 이어서 집중한 평균 시간이고, 빨간 선은 다시 시작한
        횟수예요. 두 값은 단위가 달라 각각 왼쪽과 오른쪽 축을 사용해요.
      </p>

      <div className="mt-3 rounded-xl border border-base-300/85 bg-base-200/45 p-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
          <span className="inline-flex items-center gap-1 text-success">
            <span className="h-2.5 w-3 rounded-sm bg-success/75" />
            평균 집중 구간 · 왼쪽 축
          </span>
          <span className="inline-flex items-center gap-1 text-primary">
            <span className="w-4 border-t-2 border-primary" />
            재개 횟수 · 오른쪽 축
          </span>
        </div>

        <svg
          viewBox="0 0 340 170"
          role="img"
          aria-labelledby="focus-rhythm-chart-title focus-rhythm-chart-description"
          className="mt-2 block h-auto w-full"
        >
          <title id="focus-rhythm-chart-title">평균 집중 구간과 재개 횟수 혼합 그래프 예시</title>
          <desc id="focus-rhythm-chart-description">
            날짜별 평균 집중 구간은 초록 막대, 재개 횟수는 빨간 선으로 표시한
            예시입니다.
          </desc>

          <g className="stroke-base-content/10" strokeWidth="1">
            <line x1="42" y1="40" x2="304" y2="40" />
            <line x1="42" y1="82" x2="304" y2="82" />
            <line x1="42" y1="124" x2="304" y2="124" />
          </g>
          <g className="fill-success text-[9px]">
            <text x="35" y="127" textAnchor="end">0분</text>
            <text x="35" y="85" textAnchor="end">20분</text>
            <text x="35" y="43" textAnchor="end">40분</text>
          </g>
          <g className="fill-primary text-[9px]">
            <text x="311" y="127">0회</text>
            <text x="311" y="99">1회</text>
            <text x="311" y="71">2회</text>
            <text x="311" y="43">3회</text>
          </g>

          {exampleData.map((item) => (
            <rect
              key={`${item.label}-bar`}
              x={item.x - 12}
              y={item.focusY}
              width="24"
              height={124 - item.focusY}
              rx="4"
              className="fill-success/70"
            />
          ))}
          <polyline
            points={exampleData.map((item) => `${item.x},${item.resumeY}`).join(" ")}
            fill="none"
            className="stroke-primary"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {exampleData.map((item) => (
            <circle
              key={`${item.label}-point`}
              cx={item.x}
              cy={item.resumeY}
              r="4"
              className="fill-primary stroke-base-100"
              strokeWidth="2"
            />
          ))}

          <line x1="42" y1="124" x2="304" y2="124" className="stroke-base-content/35" />
          <g className="fill-base-content/50 text-[9px]">
            {exampleData.map((item) => (
              <text key={item.label} x={item.x} y="143" textAnchor="middle">
                {item.label}
              </text>
            ))}
          </g>
        </svg>
      </div>

      <div className="mt-2 rounded-lg bg-primary/8 px-3 py-2 text-xs leading-5 text-base-content/70">
        같은 날짜의 초록 막대와 빨간 점을 함께 보면 집중이 이어진 시간과 재개 횟수를
        바로 비교할 수 있어요. 1년 조회에서는 날짜 대신 월별 값으로 묶어 보여줘요.
      </div>

      <p className="m-0 mt-2 text-[11px] leading-4 text-base-content/55">
        재개 횟수가 많다고 집중을 못했다는 뜻은 아니에요. 작업이 길면 재개 횟수도
        자연스럽게 늘어날 수 있어요.
      </p>
    </section>
  );
}
