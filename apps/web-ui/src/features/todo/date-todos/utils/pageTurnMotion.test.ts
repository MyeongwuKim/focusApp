import { describe, expect, it } from "vitest";
import {
  resolvePageTurnDurationMs,
  shouldCompletePageTurn,
} from "./pageTurnMotion";

describe("pageTurnMotion", () => {
  it("충분히 긴 드래그는 속도가 느려도 페이지 넘김을 확정한다", () => {
    expect(shouldCompletePageTurn(-56, -0.05)).toBe(true);
    expect(shouldCompletePageTurn(80, 0.04)).toBe(true);
  });

  it("짧은 흔들림은 빠르더라도 페이지 넘김으로 처리하지 않는다", () => {
    expect(shouldCompletePageTurn(12, 1.2)).toBe(false);
  });

  it("짧은 플릭은 이동 방향과 속도 방향이 같을 때만 확정한다", () => {
    expect(shouldCompletePageTurn(-28, -0.7)).toBe(true);
    expect(shouldCompletePageTurn(-28, 0.7)).toBe(false);
  });

  it("빠른 플릭은 느린 드래그보다 짧은 전환 시간을 사용한다", () => {
    expect(resolvePageTurnDurationMs(1.2)).toBeLessThan(resolvePageTurnDurationMs(0.1));
    expect(resolvePageTurnDurationMs(10)).toBeGreaterThanOrEqual(300);
  });
});
