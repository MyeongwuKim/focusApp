import { useMemo, useState } from "react";
import { FiChevronDown } from "react-icons/fi";
import type { CountBarDatum, TimeBarDatum } from "./types";
import {
  buildStatsTimeline,
  formatStatsMinutes,
  groupStatsTimelineByWeek,
} from "../utils/statsPresentation";

type StatsCrayonTimelineProps = {
  countData: CountBarDatum[];
  timeData: TimeBarDatum[];
};

/**
 * 날짜별 완료·미완료 개수와 집중 시간을 크레파스 선으로 비교해 보여 준다.
 * 날짜를 누르면 해당 날짜에 완료하거나 남긴 할 일 문구를 같은 줄 아래에서 펼친다.
 */
export function StatsCrayonTimeline({ countData, timeData }: StatsCrayonTimelineProps) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const dailyTimeline = useMemo(() => buildStatsTimeline(countData, timeData), [countData, timeData]);
  const isWeekly = dailyTimeline.length > 14;
  const timeline = useMemo(
    () => isWeekly ? groupStatsTimelineByWeek(dailyTimeline) : dailyTimeline,
    [dailyTimeline, isWeekly]
  );
  const maxTodoCount = Math.max(...timeline.map((item) => item.done + item.incomplete), 1);
  const maxFocusMinutes = Math.max(...timeline.map((item) => item.focusMin), 1);

  return (
    <section className="stats-record-section" aria-labelledby="stats-record-title">
      <div className="stats-section-heading">
        <div>
          <h3 id="stats-record-title">
            {isWeekly ? "주별 기록" : "날짜별 기록"}
          </h3>
          <p>줄을 누르면 할 일 내용을 볼 수 있어요</p>
        </div>
        <div className="stats-crayon-legend" aria-label="색상 설명">
          <span data-tone="done">완료</span>
          <span data-tone="incomplete">미완료</span>
          <span data-tone="focus">집중</span>
        </div>
      </div>

      <div className="stats-crayon-timeline">
        {timeline.map((item) => {
          const totalTodos = item.done + item.incomplete;
          const hasActivity = totalTodos > 0 || item.focusMin > 0 || item.restMin > 0;
          const todoTrackWidth = totalTodos > 0 ? 26 + (totalTodos / maxTodoCount) * 50 : 0;
          const doneRatio = totalTodos > 0 ? (item.done / totalTodos) * 100 : 0;
          const focusWidth = item.focusMin > 0 ? 22 + (item.focusMin / maxFocusMinutes) * 44 : 0;
          const isExpanded = expandedKey === item.key;

          return (
            <div
              className="stats-crayon-row"
              key={item.key}
              data-empty={!hasActivity || undefined}
              data-expanded={isExpanded || undefined}
            >
              <button
                type="button"
                className="stats-crayon-row__button"
                onClick={() => setExpandedKey((current) => current === item.key ? null : item.key)}
                aria-expanded={isExpanded}
                disabled={!hasActivity}
              >
                <span className="stats-crayon-row__date">{item.label}</span>
                <span className="stats-crayon-row__main">
                  <span className="stats-crayon-row__summary">
                    {totalTodos > 0 ? <span><b>할 일</b>{item.done}/{totalTodos}</span> : null}
                    {item.focusMin > 0 ? <span><b>집중</b>{formatStatsMinutes(item.focusMin)}</span> : null}
                    {!hasActivity ? "기록 없음" : null}
                  </span>
                  {hasActivity ? (
                    <span className="stats-crayon-row__tracks" aria-hidden="true">
                      {totalTodos > 0 ? (
                        <span className="stats-crayon-row__todo-track" style={{ width: `${todoTrackWidth}%` }}>
                          <i data-tone="done" style={{ width: `${doneRatio}%` }} />
                          <i data-tone="incomplete" style={{ width: `${100 - doneRatio}%` }} />
                        </span>
                      ) : null}
                      {item.focusMin > 0 ? (
                        <span className="stats-crayon-row__focus-track" style={{ width: `${focusWidth}%` }} />
                      ) : null}
                    </span>
                  ) : null}
                </span>
                {hasActivity ? (
                  <FiChevronDown className="stats-crayon-row__chevron" size={14} aria-hidden="true" />
                ) : null}
              </button>

              {isExpanded ? (
                <div className="stats-crayon-row__details">
                  <p>
                    <b>완료</b>
                    {item.doneLabels.length > 0 ? item.doneLabels.join(", ") : "없음"}
                  </p>
                  <p>
                    <b>미완료</b>
                    {item.incompleteLabels.length > 0 ? item.incompleteLabels.join(", ") : "없음"}
                  </p>
                  {item.restMin > 0 ? <p><b>휴식</b>{formatStatsMinutes(item.restMin)}</p> : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
