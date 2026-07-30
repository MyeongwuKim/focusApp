import { describe, expect, it } from "vitest";
import {
  EMPTY_PLAN_FALLBACK_MESSAGES,
  hasEmptyPlanRestSuggestion,
  pickEmptyPlanFallback,
} from "./motivation-message.utils.js";

describe("motivation message empty plan copy", () => {
  it("할 일이 없다는 이유로 휴식을 권하는 문장을 감지한다", () => {
    expect(hasEmptyPlanRestSuggestion("추가한 일이 없으니 오늘은 쉬어도 될 것 같아요.")).toBe(true);
    expect(hasEmptyPlanRestSuggestion("오늘은 휴식하는 날로 보내도 괜찮아요.")).toBe(true);
    expect(hasEmptyPlanRestSuggestion("일정을 보고 필요한 일 하나만 골라봐요.")).toBe(false);
  });

  it("빈 계획 기본 문구는 휴식을 추측하지 않는다", () => {
    EMPTY_PLAN_FALLBACK_MESSAGES.forEach((message) => {
      expect(hasEmptyPlanRestSuggestion(message)).toBe(false);
    });
  });

  it("날짜에 따라 준비된 기본 문구 중 하나를 선택한다", () => {
    expect(EMPTY_PLAN_FALLBACK_MESSAGES).toContain(pickEmptyPlanFallback("2026-07-29"));
    expect(EMPTY_PLAN_FALLBACK_MESSAGES).toContain(pickEmptyPlanFallback("2026-07-30"));
  });
});
