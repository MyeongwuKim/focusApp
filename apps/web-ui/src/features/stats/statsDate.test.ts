import { describe, expect, it } from "vitest";
import { formatDateInput, getPresetRange, getMonthKeysBetween } from "./statsDate";

describe("statsDate", () => {
  it("12개월 범위는 이번 달을 포함해 정확히 12개의 월 키를 만든다", () => {
    const range = getPresetRange("1y");
    const monthKeys = getMonthKeysBetween(range.start, range.end);

    expect(range.start.getDate()).toBe(1);
    expect(monthKeys).toHaveLength(12);
    expect(monthKeys.at(-1)).toBe(formatDateInput(range.end).slice(0, 7));
  });
});
