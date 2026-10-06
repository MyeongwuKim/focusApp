import { useMemo } from "react";
import type { CountBarDatum, TimeBarDatum } from "./types";
import {
  buildStatsTimeline,
  formatStatsMinutes,
} from "../utils/statsPresentation";

type StatsHighlightsProps = {
  countData: CountBarDatum[];
  timeData: TimeBarDatum[];
  activeDays: number;
  averageDonePerActiveDay: number;
  frequentIncompleteTasks: Array<{ label: string; count: number }>;
};

/** 선택 기간에서 사용자가 바로 이해할 수 있는 네 가지 기록만 골라 포스트잇 형태로 표시한다. */
export function StatsHighlights({
  countData,
  timeData,
  activeDays,
  averageDonePerActiveDay,
  frequentIncompleteTasks,
}: StatsHighlightsProps) {
  const bestFocusDay = useMemo(() => {
    return buildStatsTimeline(countData, timeData).reduce<ReturnType<typeof buildStatsTimeline>[number] | null>(
      (best, item) => !best || item.focusMin > best.focusMin ? item : best,
      null
    );
  }, [countData, timeData]);
  const frequentIncompleteTask = frequentIncompleteTasks[0] ?? null;

  return (
    <section className="stats-highlight-section" aria-labelledby="stats-highlight-title">
      <h3 id="stats-highlight-title">눈에 띄는 기록</h3>
      <div className="stats-highlight-grid">
        <article data-tone="blue">
          <p>가장 집중한 날</p>
          <strong>{bestFocusDay && bestFocusDay.focusMin > 0 ? bestFocusDay.label : "기록 없음"}</strong>
          <small>{bestFocusDay && bestFocusDay.focusMin > 0 ? formatStatsMinutes(bestFocusDay.focusMin) : ""}</small>
        </article>
        <article data-tone="coral">
          <p>자주 남은 할 일</p>
          <strong>{frequentIncompleteTask?.label ?? "없음"}</strong>
          <small>{frequentIncompleteTask ? `${frequentIncompleteTask.count}회` : ""}</small>
        </article>
        <article data-tone="green">
          <p>활동한 날</p>
          <strong>{activeDays}일</strong>
          <small>할 일·집중 기록 기준</small>
        </article>
        <article data-tone="yellow">
          <p>활동일 평균 완료</p>
          <strong>{averageDonePerActiveDay.toFixed(1)}개</strong>
          <small>기록한 날 기준</small>
        </article>
      </div>
    </section>
  );
}
