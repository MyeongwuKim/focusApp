import { describe, expect, it } from "vitest";
import {
  buildAchievementMetrics,
  getDateKeyInTimeZone,
  getIsoWeekKeyFromDateKey,
  type AchievementDayStat,
} from "./achievement.utils.js";

function createDayMap(rows: Array<[string, AchievementDayStat]>) {
  return new Map(rows);
}

describe("achievement date and metric helpers", () => {
  it("한국 시간의 날짜 경계를 사용한다", () => {
    expect(getDateKeyInTimeZone(new Date("2026-07-31T14:59:59.000Z"), "Asia/Seoul")).toBe(
      "2026-07-31"
    );
    expect(getDateKeyInTimeZone(new Date("2026-07-31T15:00:00.000Z"), "Asia/Seoul")).toBe(
      "2026-08-01"
    );
  });

  it("주간 지표는 월요일부터 오늘까지만 집계한다", () => {
    const metrics = buildAchievementMetrics(
      createDayMap([
        ["2026-08-02", { doneCount: 3, focusMinutes: 180 }],
        ["2026-08-03", { doneCount: 1, focusMinutes: 25 }],
      ]),
      "2026-08-03"
    );

    expect(metrics.weeklyDoneDays).toBe(1);
    expect(metrics.weeklyFocusMinutes).toBe(25);
  });

  it("집중 연속일의 두 가지 성공 조건과 최고 기록을 계산한다", () => {
    const metrics = buildAchievementMetrics(
      createDayMap([
        ["2026-07-30", { doneCount: 0, focusMinutes: 25 }],
        ["2026-07-31", { doneCount: 1, focusMinutes: 15 }],
        ["2026-08-01", { doneCount: 1, focusMinutes: 14 }],
      ]),
      "2026-08-01"
    );

    expect(metrics.focusStreakBest).toBe(2);
    expect(metrics.focusStreakCurrent).toBe(0);
    expect(metrics.doneStreakBest).toBe(2);
    expect(metrics.bestDailyFocusMinutes).toBe(25);
  });

  it("연말의 ISO 주차를 올바르게 계산한다", () => {
    expect(getIsoWeekKeyFromDateKey("2025-12-29")).toBe("2026-W01");
  });
});
