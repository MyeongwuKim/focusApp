import { fireEvent, render, screen } from "@testing-library/react";
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

const overdueTodo: TaskItem = {
  ...futureTodo,
  id: "todo-overdue",
  label: "미처 끝내지 못한 일",
  status: "overdue",
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

  it("할 일 글자는 옵션을 열고 왼쪽 원형 표시는 집중을 시작한다", () => {
    const onOpenMenu = vi.fn();
    const onTaskAction = vi.fn();
    render(
      <TodoItemCard
        item={futureTodo}
        onTaskAction={onTaskAction}
        onOpenMenu={onOpenMenu}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "내일 할 일, 할 일 옵션 열기" }));
    expect(onOpenMenu).toHaveBeenCalledWith("todo-future");
    expect(onTaskAction).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "집중 시작" }));
    expect(onTaskAction).toHaveBeenCalledWith("todo-future", "start");
  });

  it("미완료 상태는 별도 상태 줄 없이 왼쪽 표시에만 반영한다", () => {
    render(
      <TodoItemCard
        item={overdueTodo}
        onTaskAction={vi.fn()}
        onOpenMenu={vi.fn()}
      />
    );

    expect(screen.getByRole("button", { name: "미완료된 할 일" })).toBeInTheDocument();
    expect(screen.queryByText("미완료")).not.toBeInTheDocument();
  });

  it("오른쪽 제스처 영역에 그리기 표시를 두고 키보드로 사용법을 열 수 있다", () => {
    render(
      <TodoItemCard
        item={futureTodo}
        onTaskAction={vi.fn()}
        onOpenMenu={vi.fn()}
        onDeleteGesture={vi.fn()}
      />
    );

    const gestureGuide = screen.getByRole("button", { name: /그리기 제스처 안내/ });
    expect(gestureGuide).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("빠른 동작")).toBeInTheDocument();

    fireEvent.keyDown(gestureGuide, { key: "Enter" });

    expect(gestureGuide).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("V 그리기 → 완료")).toBeInTheDocument();
    expect(screen.getByText("가로선 → 삭제")).toBeInTheDocument();
  });
});
