import { describe, expect, it } from "vitest";
import {
  computeNextReminderAtAfterRun,
  computeNextReminderAtForSettingsRefresh,
} from "./notification-reminder-schedule.js";

function createSettings(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    pushEnabled: true,
    intervalMinutes: 30,
    activeStartTime: "00:00",
    activeEndTime: "23:59",
    dayMode: "everyday",
    typeIncomplete: true,
    typeFocusStart: true,
    systemPermission: "granted",
    nextReminderAt: null,
    ...overrides,
  };
}

describe("computeNextReminderAtAfterRun", () => {
  it("실행 지연이 있어도 기존 예약 시각 기준으로 다음 알림을 계산한다", () => {
    const nextReminderAt = computeNextReminderAtAfterRun({
      settings: createSettings({
        nextReminderAt: new Date("2026-05-11T01:30:00.000Z"),
      }),
      now: new Date("2026-05-11T01:34:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-11T02:00:00.000Z");
  });

  it("기존 예약 시각이 없으면 현재 실행 시각 기준으로 다음 알림을 계산한다", () => {
    const nextReminderAt = computeNextReminderAtAfterRun({
      settings: createSettings(),
      now: new Date("2026-05-11T01:34:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-11T02:04:00.000Z");
  });

  it("다음 알림 시각이 비활성 시간대면 다음 활성 시작 시각으로 보정한다", () => {
    const nextReminderAt = computeNextReminderAtAfterRun({
      settings: createSettings({
        activeStartTime: "09:00",
        activeEndTime: "23:00",
        nextReminderAt: new Date("2026-05-11T14:30:00.000Z"),
      }),
      now: new Date("2026-05-11T14:50:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-12T00:00:00.000Z");
  });
});

describe("computeNextReminderAtForSettingsRefresh", () => {
  it("활성 시간대 변경 시 즉시 시각이 아닌 다음 간격 슬롯으로 예약한다", () => {
    const nextReminderAt = computeNextReminderAtForSettingsRefresh({
      settings: createSettings({
        nextReminderAt: null,
      }),
      now: new Date("2026-05-11T01:34:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-11T02:04:00.000Z");
  });

  it("기존 예약 시각이 있으면 기존 예약 기준 주기를 유지한다", () => {
    const nextReminderAt = computeNextReminderAtForSettingsRefresh({
      settings: createSettings({
        nextReminderAt: new Date("2026-05-11T02:00:00.000Z"),
      }),
      now: new Date("2026-05-11T01:40:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-11T02:00:00.000Z");
  });

  it("기존 예약 시각이 너무 멀리 있으면 다음 간격 슬롯으로 당겨 예약한다", () => {
    const nextReminderAt = computeNextReminderAtForSettingsRefresh({
      settings: createSettings({
        intervalMinutes: 60,
        nextReminderAt: new Date("2026-05-12T12:00:00.000Z"),
      }),
      now: new Date("2026-05-11T01:34:00.000Z"),
      timezone: "Asia/Seoul",
    });

    expect(nextReminderAt?.toISOString()).toBe("2026-05-11T02:34:00.000Z");
  });
});
