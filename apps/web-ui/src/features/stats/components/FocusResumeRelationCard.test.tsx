import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { FocusResumeRelationCard } from "./FocusResumeRelationCard";

describe("FocusResumeRelationCard", () => {
  it.each([
    ["all", "전체 집중 리듬"],
    ["task", "이 할 일의 집중 리듬"],
  ] as const)("%s 통계 카드에서 집중 리듬 안내를 열고 닫는다", async (scope, title) => {
    const user = userEvent.setup();

    render(
      <FocusResumeRelationCard
        scope={scope}
        taskLabel={scope === "task" ? "테스트 할 일" : undefined}
        focusMinutes={0}
        resumeCount={0}
        averageResumesPerTask={null}
        averageFocusSegmentMinutes={null}
        useMonthlyBar={false}
        data={[]}
      />
    );

    expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "집중 리듬 안내" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "집중 리듬 설명 보기" }));

    expect(screen.getByRole("dialog", { name: "집중 리듬 안내" })).toBeInTheDocument();
    expect(screen.getByText("혼합 그래프 읽는 법")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "닫기" }));

    expect(screen.queryByRole("dialog", { name: "집중 리듬 안내" })).not.toBeInTheDocument();
  });

  it("같은 날짜의 실행 기록을 평균 집중 구간으로 합산한다", () => {
    render(
      <FocusResumeRelationCard
        scope="all"
        focusMinutes={130}
        resumeCount={1}
        averageResumesPerTask={0.3}
        averageFocusSegmentMinutes={32.5}
        useMonthlyBar={false}
        data={[
          {
            id: "2026-05-08-task-1",
            dateKey: "2026-05-08",
            taskLabel: "첫 번째 할 일",
            focusMin: 30,
            resumeCount: 0,
            done: true,
          },
          {
            id: "2026-05-08-task-2",
            dateKey: "2026-05-08",
            taskLabel: "두 번째 할 일",
            focusMin: 60,
            resumeCount: 1,
            done: true,
          },
          {
            id: "2026-05-09-task-3",
            dateKey: "2026-05-09",
            taskLabel: "세 번째 할 일",
            focusMin: 40,
            resumeCount: 0,
            done: true,
          },
        ]}
      />
    );

    expect(
      screen.getByRole("img", {
        name: "날짜별 평균 집중 구간과 재개 횟수 혼합 그래프",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /05\.08 평균 집중 구간 30분 · 집중 기록 2개 · 총 집중 90분 · 재개 1회/
      )
    ).toBeInTheDocument();
  });

  it("긴 기간에는 실행 기록을 월별 평균 집중 구간으로 합산한다", () => {
    render(
      <FocusResumeRelationCard
        scope="all"
        focusMinutes={130}
        resumeCount={1}
        averageResumesPerTask={0.3}
        averageFocusSegmentMinutes={32.5}
        useMonthlyBar
        data={[
          {
            id: "2026-05-08-task-1",
            dateKey: "2026-05-08",
            taskLabel: "첫 번째 할 일",
            focusMin: 30,
            resumeCount: 0,
            done: true,
          },
          {
            id: "2026-05-09-task-2",
            dateKey: "2026-05-09",
            taskLabel: "두 번째 할 일",
            focusMin: 60,
            resumeCount: 1,
            done: true,
          },
          {
            id: "2026-06-01-task-3",
            dateKey: "2026-06-01",
            taskLabel: "세 번째 할 일",
            focusMin: 40,
            resumeCount: 0,
            done: true,
          },
        ]}
      />
    );

    expect(
      screen.getByRole("img", {
        name: "월별 평균 집중 구간과 재개 횟수 혼합 그래프",
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /05월 평균 집중 구간 30분 · 집중 기록 2개 · 총 집중 90분 · 재개 1회/
      )
    ).toBeInTheDocument();
  });
});
