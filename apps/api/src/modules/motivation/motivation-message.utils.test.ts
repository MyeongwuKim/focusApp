import { describe, expect, it } from "vitest";
import {
  ALL_DONE_FALLBACK_MESSAGES,
  EMPTY_PLAN_FALLBACK_MESSAGES,
  IN_PROGRESS_FALLBACK_MESSAGES,
  NOT_STARTED_FALLBACK_MESSAGES,
  PARTIAL_DONE_FALLBACK_MESSAGES,
  hasConsistentHaeyoSpeechLevel,
  hasRestSuggestion,
  pickEmptyPlanFallback,
  pickMotivationFallback,
  resolveMotivationMessageState,
} from "./motivation-message.utils.js";

describe("motivation message empty plan copy", () => {
  it("할 일이 없다는 이유로 휴식을 권하는 문장을 감지한다", () => {
    expect(hasRestSuggestion("추가한 일이 없으니 오늘은 쉬어도 될 것 같아요.")).toBe(true);
    expect(hasRestSuggestion("오늘은 휴식하는 날로 보내도 괜찮아요.")).toBe(true);
    expect(hasRestSuggestion("일정을 보고 필요한 일 하나만 골라봐요.")).toBe(false);
  });

  it("모든 상태의 기본 문구는 휴식을 권하지 않고 해요체를 유지한다", () => {
    const fallbackMessages = [
      ...EMPTY_PLAN_FALLBACK_MESSAGES,
      ...NOT_STARTED_FALLBACK_MESSAGES,
      ...IN_PROGRESS_FALLBACK_MESSAGES,
      ...PARTIAL_DONE_FALLBACK_MESSAGES,
      ...ALL_DONE_FALLBACK_MESSAGES,
    ];

    fallbackMessages.forEach((message) => {
      expect(hasRestSuggestion(message)).toBe(false);
      expect(hasConsistentHaeyoSpeechLevel(message)).toBe(true);
    });
  });

  it("부드러운 해요체만 허용한다", () => {
    expect(hasConsistentHaeyoSpeechLevel("가장 중요한 일 하나부터 같이 골라봐요.")).toBe(true);
    expect(hasConsistentHaeyoSpeechLevel("가장 중요한 일 하나부터 골라봐.")).toBe(false);
    expect(hasConsistentHaeyoSpeechLevel("가장 중요한 일 하나부터 시작하세요.")).toBe(false);
    expect(hasConsistentHaeyoSpeechLevel("가장 중요한 일 하나부터 시작합니다.")).toBe(false);
  });

  it("날짜에 따라 준비된 기본 문구 중 하나를 선택한다", () => {
    expect(EMPTY_PLAN_FALLBACK_MESSAGES).toContain(pickEmptyPlanFallback("2026-07-29"));
    expect(EMPTY_PLAN_FALLBACK_MESSAGES).toContain(pickEmptyPlanFallback("2026-07-30"));
    expect(pickMotivationFallback("IN_PROGRESS", "2026-07-29")).toBe(
      pickMotivationFallback("IN_PROGRESS", "2026-07-29")
    );
  });

  it("오늘의 할 일과 진행 상태를 메시지 상태로 분류한다", () => {
    expect(
      resolveMotivationMessageState({ todoCount: 0, doneCount: 0, openCount: 0, hasInProgressTodo: false })
    ).toBe("EMPTY");
    expect(
      resolveMotivationMessageState({ todoCount: 2, doneCount: 0, openCount: 2, hasInProgressTodo: false })
    ).toBe("NOT_STARTED");
    expect(
      resolveMotivationMessageState({ todoCount: 2, doneCount: 0, openCount: 2, hasInProgressTodo: true })
    ).toBe("IN_PROGRESS");
    expect(
      resolveMotivationMessageState({ todoCount: 2, doneCount: 1, openCount: 1, hasInProgressTodo: false })
    ).toBe("PARTIAL_DONE");
    expect(
      resolveMotivationMessageState({ todoCount: 2, doneCount: 2, openCount: 0, hasInProgressTodo: false })
    ).toBe("ALL_DONE");
  });
});
