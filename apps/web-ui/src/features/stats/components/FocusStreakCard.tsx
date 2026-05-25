type FocusStreakCardProps = {
  currentStreak: number;
  bestStreak: number;
  state: "active" | "at_risk" | "idle";
  isTodayFocused: boolean;
};

function buildStateMessage(state: FocusStreakCardProps["state"], isTodayFocused: boolean) {
  if (state === "active") {
    return isTodayFocused ? "오늘 집중으로 연속일 유지 중" : "연속일 유지 진행 중";
  }
  if (state === "at_risk") {
    return "오늘 15분 이상 집중하면 연속일 유지";
  }
  return "오늘 첫 집중으로 새 연속일 시작";
}

export function FocusStreakCard({ currentStreak, bestStreak, state, isTodayFocused }: FocusStreakCardProps) {
  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content/85">집중 연속일</h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            state === "active" ? "bg-emerald-500/15 text-emerald-700" : "",
            state === "at_risk" ? "bg-amber-500/15 text-amber-700" : "",
            state === "idle" ? "bg-base-300/55 text-base-content/70" : "",
          ].join(" ")}
        >
          {state === "active" ? "유지 중" : state === "at_risk" ? "주의" : "대기"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-info/25 bg-info/10 px-3 py-2">
          <p className="m-0 text-xs text-info/80">현재</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-info">{currentStreak}일</p>
        </div>
        <div className="rounded-lg border border-warning/30 bg-warning/12 px-3 py-2">
          <p className="m-0 text-xs text-warning/85">최고</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-warning">{bestStreak}일</p>
        </div>
      </div>

      <p className="m-0 mt-2 text-[11px] text-base-content/65">{buildStateMessage(state, isTodayFocused)}</p>
      <p className="m-0 mt-0.5 text-[11px] text-base-content/55">기준: 25분 이상 집중 또는 15분+완료 1개</p>
    </article>
  );
}
