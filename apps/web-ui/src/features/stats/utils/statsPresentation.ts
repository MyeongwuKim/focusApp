import type { CountBarDatum, TimeBarDatum } from "../components/types";

export type StatsTimelineDatum = {
  key: string;
  label: string;
  done: number;
  incomplete: number;
  doneLabels: string[];
  incompleteLabels: string[];
  focusMin: number;
  restMin: number;
};

/** 분 단위 통계를 짧은 한국어 시간 표현으로 바꾼다. */
export function formatStatsMinutes(minutes: number) {
  const normalizedMinutes = Math.max(Math.floor(minutes), 0);
  if (normalizedMinutes < 60) {
    return `${normalizedMinutes}분`;
  }

  const hours = Math.floor(normalizedMinutes / 60);
  const remainingMinutes = normalizedMinutes % 60;
  return remainingMinutes > 0 ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
}

/** YYYY-MM-DD 또는 YYYY-MM 값을 통계 목록에서 읽기 쉬운 월·일 또는 월 이름으로 표시한다. */
export function formatStatsPeriodLabel(dateKey: string) {
  const parts = dateKey.split("-").map(Number);
  if (parts.length === 2) {
    return Number.isFinite(parts[1]) ? `${parts[1]}월` : dateKey;
  }
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) {
    return dateKey;
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const weekday = new Intl.DateTimeFormat("ko-KR", { weekday: "short" }).format(date);
  return `${parts[1]}/${parts[2]} ${weekday}`;
}

/**
 * 완료·미완료 집계와 집중·휴식 집계를 같은 날짜 키로 합쳐 한 줄짜리 기록 데이터로 만든다.
 * 두 배열 중 한쪽에만 존재하는 기간도 누락하지 않고 0으로 채운다.
 */
export function buildStatsTimeline(countData: CountBarDatum[], timeData: TimeBarDatum[]) {
  const timeByKey = new Map(timeData.map((item) => [item.tooltipLabel, item]));
  const countKeys = new Set(countData.map((item) => item.tooltipLabel));
  const timeline: StatsTimelineDatum[] = countData.map((countItem) => {
    const timeItem = timeByKey.get(countItem.tooltipLabel);
    return {
      key: countItem.tooltipLabel,
      label: formatStatsPeriodLabel(countItem.tooltipLabel),
      done: countItem.done,
      incomplete: countItem.incomplete,
      doneLabels: countItem.doneLabels,
      incompleteLabels: countItem.incompleteLabels,
      focusMin: timeItem?.focusMin ?? 0,
      restMin: timeItem?.restMin ?? 0,
    };
  });

  timeData.forEach((timeItem) => {
    if (countKeys.has(timeItem.tooltipLabel)) {
      return;
    }
    timeline.push({
      key: timeItem.tooltipLabel,
      label: formatStatsPeriodLabel(timeItem.tooltipLabel),
      done: 0,
      incomplete: 0,
      doneLabels: [],
      incompleteLabels: [],
      focusMin: timeItem.focusMin,
      restMin: timeItem.restMin,
    });
  });

  return timeline.sort((a, b) => a.key.localeCompare(b.key));
}

/** 30일처럼 날짜가 많은 범위는 시작일부터 7일씩 묶어 주별 기록으로 줄인다. */
export function groupStatsTimelineByWeek(timeline: StatsTimelineDatum[]) {
  const groups: StatsTimelineDatum[] = [];

  for (let index = 0; index < timeline.length; index += 7) {
    const week = timeline.slice(index, index + 7);
    const first = week[0];
    const last = week[week.length - 1];
    if (!first || !last) {
      continue;
    }

    groups.push({
      key: `${first.key}~${last.key}`,
      label: `${first.label.split(" ")[0]}~${last.label.split(" ")[0]}`,
      done: week.reduce((total, item) => total + item.done, 0),
      incomplete: week.reduce((total, item) => total + item.incomplete, 0),
      doneLabels: week.flatMap((item) => item.doneLabels),
      incompleteLabels: week.flatMap((item) => item.incompleteLabels),
      focusMin: week.reduce((total, item) => total + item.focusMin, 0),
      restMin: week.reduce((total, item) => total + item.restMin, 0),
    });
  }

  return groups;
}
