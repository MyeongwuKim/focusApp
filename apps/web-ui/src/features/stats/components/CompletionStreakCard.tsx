type CompletionStreakCardProps = {
  currentCompletionStreak: number;
  bestCompletionStreak: number;
  isTodayCompleted: boolean;
};

function buildStateMessage(isTodayCompleted: boolean) {
  if (isTodayCompleted) {
    return "오늘 완료로 연속 완료 기록 유지 중";
  }
  return "오늘 할일 1개 이상 완료 시 연속 기록 반영";
}

export function CompletionStreakCard({
  currentCompletionStreak,
  bestCompletionStreak,
  isTodayCompleted,
}: CompletionStreakCardProps) {
  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content/85">연속 완료</h3>
        <span
          className={[
            "rounded-full px-2 py-0.5 text-[11px] font-semibold",
            isTodayCompleted ? "bg-emerald-500/15 text-emerald-700" : "bg-base-300/55 text-base-content/70",
          ].join(" ")}
        >
          {isTodayCompleted ? "유지 중" : "대기"}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2">
          <p className="m-0 text-xs text-emerald-700/85">현재</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-emerald-700">{currentCompletionStreak}일</p>
        </div>
        <div className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-2">
          <p className="m-0 text-xs text-cyan-700/85">최고</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-cyan-700">{bestCompletionStreak}일</p>
        </div>
      </div>

      <p className="m-0 mt-2 text-[11px] text-base-content/65">{buildStateMessage(isTodayCompleted)}</p>
      <p className="m-0 mt-0.5 text-[11px] text-base-content/55">기준: 해당 날짜 완료 1개 이상</p>
    </article>
  );
}
