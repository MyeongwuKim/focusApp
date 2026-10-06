import { describe, expect, it } from "vitest";
import type { TaskItem } from "../../types";
import { summarizeDateTodoItems } from "./dateTodosSummary";

function createTask(id: string, status: TaskItem["status"], completedMinutes = 0): TaskItem {
  return {
    id,
    label: id,
    status,
    accumulatedMs: completedMinutes * 60000,
    startedAt: null,
    scheduledStartAt: null,
    targetFocusMinutes: null,
    completedAt: status === "done" ? 1 : null,
    completedDurationMs: status === "done" ? completedMinutes * 60000 : null,
  };
}

describe("summarizeDateTodoItems", () => {
  const items = [createTask("done", "done", 20), createTask("todo", "todo")];

  it("전체 항목의 완료 수와 진행률을 계산한다", () => {
    expect(summarizeDateTodoItems(items)).toEqual({
      completedCount: 1,
      totalCount: 2,
      totalMinutes: 20,
      progressPercent: 50,
    });
  });

  it("되돌리기 대기 항목을 제외해 진행률을 즉시 계산한다", () => {
    expect(summarizeDateTodoItems(items, "todo")).toEqual({
      completedCount: 1,
      totalCount: 1,
      totalMinutes: 20,
      progressPercent: 100,
    });
  });
});
