import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TodoItemCard } from "./TodoItemCard";
import type { TaskItem } from "../types";

const futureTodo: TaskItem = {
  id: "todo-future",
  label: "내일 할 일",
  status: "todo",
  accumulatedMs: 0,
  startedAt: null,
  scheduledStartAt: null,
  targetFocusMinutes: null,
  completedAt: null,
  completedDurationMs: null,
};

describe("TodoItemCard", () => {
  it("미래 할일은 시작 버튼 대신 예정 상태를 표시한다", () => {
    render(
      <TodoItemCard
        item={futureTodo}
        onTaskAction={vi.fn()}
        onOpenMenu={vi.fn()}
        canRunFocus={false}
      />
    );

    expect(screen.getByText("예정")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "할일 시작" })).not.toBeInTheDocument();
  });
});
