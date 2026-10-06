import { formatStatsMinutes } from "../utils/statsPresentation";

type StatsSummaryNoteProps = {
  doneCount: number;
  incompleteCount: number;
  focusMinutes: number;
  activeDays: number;
  rangeDays: number;
  periodLabel?: string;
};

/** 선택 기간의 완료·집중·기록일을 한 문장으로 먼저 보여 주는 통계 요약 영역이다. */
export function StatsSummaryNote({
  doneCount,
  incompleteCount,
  focusMinutes,
  activeDays,
  rangeDays,
  periodLabel,
}: StatsSummaryNoteProps) {
  const totalCount = doneCount + incompleteCount;

  return (
    <section className="stats-summary-note" aria-label="선택 기간 요약">
      <p className="stats-summary-note__eyebrow">{periodLabel ?? `이번 ${rangeDays}일 기록`}</p>
      <div className="stats-summary-note__sentence">
        <p>할 일 <strong>{doneCount}/{totalCount}</strong> 완료</p>
        <p>
          집중 <strong>{formatStatsMinutes(focusMinutes)}</strong>
          <span aria-hidden="true"> · </span>
          <strong>{activeDays}일</strong>
        </p>
      </div>
      <div className="stats-summary-note__completion" aria-label={`전체 할 일 ${totalCount}개 중 ${doneCount}개 완료`}>
        <span
          style={{ width: `${totalCount > 0 ? Math.max((doneCount / totalCount) * 100, 2) : 0}%` }}
        />
      </div>
    </section>
  );
}
