type StatsWeeklyReviewCardProps = {
  startDate: string;
  endDate: string;
  goodDays: number;
  roughDays: number;
};

export function StatsWeeklyReviewCard({
  startDate,
  endDate,
  goodDays,
  roughDays,
}: StatsWeeklyReviewCardProps) {
  return (
    <article className="rounded-xl border border-base-300/80 bg-base-200/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-base-content/85">주간 회고</h3>
        <span className="text-xs text-base-content/55">
          {startDate} ~ {endDate}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-lg border border-emerald-300/55 bg-emerald-500/10 px-3 py-2">
          <p className="m-0 text-xs text-emerald-600/90">잘한 날</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-emerald-700">{goodDays}일</p>
        </div>
        <div className="rounded-lg border border-amber-300/55 bg-amber-500/10 px-3 py-2">
          <p className="m-0 text-xs text-amber-600/90">흐트러진 날</p>
          <p className="m-0 mt-0.5 text-lg font-semibold text-amber-700">{roughDays}일</p>
        </div>
      </div>
    </article>
  );
}
