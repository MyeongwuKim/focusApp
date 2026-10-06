import { describe, expect, it } from "vitest";
import {
  buildStatsTimeline,
  formatStatsMinutes,
  formatStatsPeriodLabel,
  groupStatsTimelineByWeek,
} from "./statsPresentation";

describe("statsPresentation", () => {
  it("분 단위 시간을 시간과 남은 분으로 표시한다", () => {
    expect(formatStatsMinutes(45)).toBe("45분");
    expect(formatStatsMinutes(120)).toBe("2시간");
    expect(formatStatsMinutes(135)).toBe("2시간 15분");
  });

  it("날짜와 월 키를 짧은 한글 표시로 바꾼다", () => {
    expect(formatStatsPeriodLabel("2026-05")).toBe("5월");
    expect(formatStatsPeriodLabel("2026-05-13")).toContain("5/13");
  });

  it("할 일과 시간 집계를 같은 날짜로 합친다", () => {
    expect(buildStatsTimeline(
      [{
        label: "05-13",
        tooltipLabel: "2026-05-13",
        done: 2,
        incomplete: 1,
        doneLabels: ["기획", "정리"],
        incompleteLabels: ["운동"],
      }],
      [{
        label: "05-13",
        tooltipLabel: "2026-05-13",
        focusMin: 75,
        restMin: 20,
      }]
    )[0]).toMatchObject({
      key: "2026-05-13",
      done: 2,
      incomplete: 1,
      focusMin: 75,
      restMin: 20,
    });
  });

  it("긴 날짜 목록은 7일 단위 합계로 묶는다", () => {
    const timeline = Array.from({ length: 8 }, (_, index) => ({
      key: `2026-05-${String(index + 1).padStart(2, "0")}`,
      label: `5/${index + 1} 금`,
      done: 1,
      incomplete: index % 2,
      doneLabels: [`완료 ${index + 1}`],
      incompleteLabels: [],
      focusMin: 10,
      restMin: 5,
    }));

    const groups = groupStatsTimelineByWeek(timeline);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toMatchObject({ done: 7, focusMin: 70, restMin: 35 });
    expect(groups[1]).toMatchObject({ done: 1, focusMin: 10, restMin: 5 });
  });
});
