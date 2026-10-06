import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { CountBarDatum, TimeBarDatum } from "./types";
import { buildStatsTimeline, formatStatsMinutes } from "../utils/statsPresentation";

type StatsMonthlyOverviewProps = {
  countData: CountBarDatum[];
  timeData: TimeBarDatum[];
};

/**
 * 긴 기간의 통계를 연도별 월 메모 격자로 보여 준다.
 * 기록이 있는 달을 누르면 해당 달의 완료·미완료 문구와 휴식 시간을 격자 아래에 펼친다.
 */
export function StatsMonthlyOverview({ countData, timeData }: StatsMonthlyOverviewProps) {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const timeline = useMemo(() => buildStatsTimeline(countData, timeData), [countData, timeData]);
  const groupedByYear = useMemo(() => {
    const groups = new Map<string, typeof timeline>();
    timeline.forEach((item) => {
      const year = item.key.slice(0, 4);
      groups.set(year, [...(groups.get(year) ?? []), item]);
    });
    return [...groups.entries()];
  }, [timeline]);
  const selectedMonth = timeline.find((item) => item.key === selectedKey) ?? null;
  const maxTodoCount = Math.max(...timeline.map((item) => item.done + item.incomplete), 1);

  return (
    <section className="stats-record-section stats-monthly-overview" aria-labelledby="stats-monthly-title">
      <div className="stats-section-heading">
        <div>
          <h3 id="stats-monthly-title">12개월 한눈에 보기</h3>
          <p>색이 진할수록 그달에 기록한 할 일이 많아요</p>
        </div>
        <div className="stats-crayon-legend" aria-label="색상 설명">
          <span data-tone="done">완료</span>
          <span data-tone="incomplete">미완료</span>
        </div>
      </div>

      <div className="stats-monthly-overview__years">
        {groupedByYear.map(([year, months]) => (
          <section className="stats-monthly-year" key={year} aria-label={`${year}년 기록`}>
            <h4><span>{year}</span>년</h4>
            <div className="stats-monthly-grid">
              {months.map((item) => {
                const totalTodos = item.done + item.incomplete;
                const hasActivity = totalTodos > 0 || item.focusMin > 0 || item.restMin > 0;
                const activityStrength = totalTodos > 0 ? totalTodos / maxTodoCount : 0;
                const doneRatio = totalTodos > 0 ? (item.done / totalTodos) * 100 : 0;
                const isSelected = selectedKey === item.key;
                const primaryText = totalTodos > 0
                  ? `${item.done}/${totalTodos}`
                  : formatStatsMinutes(item.focusMin > 0 ? item.focusMin : item.restMin);
                let secondaryText = item.focusMin > 0 ? "집중 기록" : "휴식 기록";
                if (totalTodos > 0) {
                  secondaryText = item.focusMin > 0 ? `집중 ${formatStatsMinutes(item.focusMin)}` : "집중 기록 없음";
                }

                return (
                  <button
                    type="button"
                    className="stats-month-card"
                    key={item.key}
                    data-empty={!hasActivity || undefined}
                    data-selected={isSelected || undefined}
                    disabled={!hasActivity}
                    onClick={() => setSelectedKey((current) => current === item.key ? null : item.key)}
                    aria-expanded={hasActivity ? isSelected : undefined}
                    style={{ "--month-activity-opacity": 0.15 + activityStrength * 0.28 } as CSSProperties}
                  >
                    <span className="stats-month-card__month">{Number(item.key.slice(5))}월</span>
                    {hasActivity ? (
                      <>
                        <strong>{primaryText}</strong>
                        <small>{secondaryText}</small>
                        {totalTodos > 0 ? (
                          <span className="stats-month-card__stroke" aria-hidden="true">
                            <i data-tone="done" style={{ width: `${doneRatio}%` }} />
                            <i data-tone="incomplete" style={{ width: `${100 - doneRatio}%` }} />
                          </span>
                        ) : null}
                      </>
                    ) : <small>기록 없음</small>}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {selectedMonth ? (
        <div className="stats-monthly-detail">
          <h4>{selectedMonth.key.replace("-", ".")} 기록</h4>
          <p><b>완료</b>{selectedMonth.doneLabels.length > 0 ? selectedMonth.doneLabels.join(", ") : "없음"}</p>
          <p><b>미완료</b>{selectedMonth.incompleteLabels.length > 0 ? selectedMonth.incompleteLabels.join(", ") : "없음"}</p>
          {selectedMonth.restMin > 0 ? <p><b>휴식</b>{formatStatsMinutes(selectedMonth.restMin)}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
