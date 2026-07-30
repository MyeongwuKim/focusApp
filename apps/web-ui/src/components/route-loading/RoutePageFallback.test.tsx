import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { RoutePageFallback, TaskStatsRouteFallback } from "./RoutePageFallback";

afterEach(() => {
  cleanup();
});

describe("RoutePageFallback", () => {
  it.each([
    ["settings", "/settings", "settings"],
    ["routine", "/routines", "routine"],
    ["tasks", "/tasks", "tasks"],
    ["stats", "/stats", "stats"],
    ["achievements", "/achievements", "achievements"],
    ["memo", "/memo", "memo"],
  ] as const)("%s 화면의 고정 레이아웃 fallback을 렌더링한다", (route, pathname, fallbackName) => {
    const { container } = render(
      <RoutePageFallback route={route} forcedPathname={pathname} />
    );

    const fallback = container.querySelector(`[data-route-fallback="${fallbackName}"]`);
    expect(fallback).not.toBeNull();
    expect(fallback).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".animate-pulse")).toBeNull();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("설정 상세 경로에 실제 상세 카드 구조를 유지한다", () => {
    const { container } = render(
      <RoutePageFallback route="settings" forcedPathname="/settings/weather" />
    );

    const fallback = container.querySelector('[data-route-fallback="settings"]');
    expect(fallback).toHaveClass("h-full", "overflow-y-auto");
    expect(fallback?.querySelectorAll("section > div.mt-6 > div")).toHaveLength(5);
  });

  it("할 일 통계 경로에는 통계 전용 fallback을 사용한다", () => {
    const { container } = render(
      <RoutePageFallback route="tasks" forcedPathname="/tasks/stats" />
    );

    expect(container.querySelector('[data-route-fallback="task-stats"]')).not.toBeNull();
    expect(container.querySelector('[data-route-fallback="tasks"]')).toBeNull();
  });
});

describe("TaskStatsRouteFallback", () => {
  it("독립 Suspense 경계에서도 전체 높이를 차지한다", () => {
    const { container } = render(<TaskStatsRouteFallback />);
    const fallback = container.querySelector('[data-route-fallback="task-stats"]');

    expect(fallback).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
  });
});
