import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import * as dailyLogApi from "../../api/dailyLogApi";
import { dailyLogsByMonthQueryKey, statsDailyDetailQueryKey } from "../../queries/daily-log/queries";
import { useStatsMetrics } from "./useStatsMetrics";

vi.mock("../../api/dailyLogApi", async () => {
  const actual = await vi.importActual<typeof import("../../api/dailyLogApi")>("../../api/dailyLogApi");
  return {
    ...actual,
    fetchDailyLogsByMonth: vi.fn().mockResolvedValue([]),
    fetchDailyLogByDate: vi.fn().mockResolvedValue(null),
  };
});

type DailyLogByDate = Awaited<ReturnType<typeof dailyLogApi.fetchDailyLogByDate>>;
type MonthlyLogSnapshot = Awaited<ReturnType<typeof dailyLogApi.fetchDailyLogsByMonth>>[number];

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function buildMonthlyLog(done: boolean): MonthlyLogSnapshot {
  return {
    id: "daily-log-2026-04-25",
    userId: "user-1",
    dateKey: "2026-04-25",
    monthKey: "2026-04",
    memo: null,
    todoCount: 1,
    doneCount: done ? 1 : 0,
    previewTodos: ["할일 1"],
    todos: [
      {
        id: "todo-1",
        taskId: "task-1",
        titleSnapshot: "할일 1",
        content: "할일 1",
        done,
        order: 0,
      },
    ],
  };
}

function buildDailyDetail(done: boolean, resumeCount = 0): NonNullable<DailyLogByDate> {
  return {
    dateKey: "2026-04-25",
    memo: null,
    restAccumulatedSeconds: 0,
    restStartedAt: null,
    todos: [
      {
        id: "todo-1",
        taskId: "task-1",
        titleSnapshot: "할일 1",
        content: "할일 1",
        done,
        order: 0,
        startedAt: "2026-04-25T08:00:00.000Z",
        scheduledStartAt: null,
        targetFocusMinutes: null,
        muteReminderDateKey: null,
        pausedAt: null,
        completedAt: done ? "2026-04-25T09:00:00.000Z" : null,
        deviationSeconds: 0,
        resumeCount,
        actualFocusSeconds: done ? 3600 : null,
      },
    ],
  };
}

function buildResumedIncompleteDailyDetail(): NonNullable<DailyLogByDate> {
  return {
    ...buildDailyDetail(false, 1),
    todos: [
      {
        ...buildDailyDetail(false, 1).todos[0],
        startedAt: "2026-04-25T08:00:00.000Z",
        pausedAt: "2026-04-25T09:30:00.000Z",
        deviationSeconds: 1800,
      },
    ],
  };
}

describe("useStatsMetrics cache recompute", () => {
  it("과거 날짜 done 상태 캐시 변경 시 집계 값을 즉시 재계산한다", async () => {
    const queryClient = createQueryClient();
    const start = new Date(2026, 3, 20);
    const end = new Date(2026, 3, 26);
    const todayKey = "2026-04-26";
    const monthKey = "2026-04";
    const dateKey = "2026-04-25";

    queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [buildMonthlyLog(false)]);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), buildDailyDetail(false));

    const { result } = renderHook(
      () =>
        useStatsMetrics({
          start,
          end,
          todayKey,
          enabled: true,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.count.doneTodos).toBe(0);
      expect(result.current.count.incompleteTodos).toBe(1);
    });

    act(() => {
      queryClient.setQueryData(dailyLogsByMonthQueryKey(monthKey), [buildMonthlyLog(true)]);
      queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), buildDailyDetail(true));
    });

    await waitFor(() => {
      expect(result.current.count.doneTodos).toBe(1);
      expect(result.current.count.incompleteTodos).toBe(0);
    });
  });

  it("집중시간과 재개 횟수로 작업당 평균 재개와 평균 집중 구간을 계산한다", async () => {
    const queryClient = createQueryClient();
    const start = new Date(2026, 3, 25);
    const end = new Date(2026, 3, 25);
    const dateKey = "2026-04-25";

    queryClient.setQueryData(dailyLogsByMonthQueryKey("2026-04"), [buildMonthlyLog(true)]);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), buildDailyDetail(true, 2));

    const { result } = renderHook(
      () =>
        useStatsMetrics({
          start,
          end,
          todayKey: dateKey,
          enabled: true,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.focusResume.focusMinutes).toBe(60);
      expect(result.current.focusResume.resumeCount).toBe(2);
      expect(result.current.focusResume.averageResumesPerTask).toBe(2);
      expect(result.current.focusResume.averageFocusSegmentMinutes).toBe(20);
      expect(result.current.focusResume.data).toEqual([
        {
          id: `${dateKey}-todo-1`,
          dateKey,
          taskLabel: "할일 1",
          focusMin: 60,
          resumeCount: 2,
          done: true,
        },
      ]);
    });
  });

  it("재개된 미완료 할일의 집중시간에서 이전 일시정지 누적시간을 제외한다", async () => {
    const queryClient = createQueryClient();
    const dateKey = "2026-04-25";

    queryClient.setQueryData(dailyLogsByMonthQueryKey("2026-04"), [buildMonthlyLog(false)]);
    queryClient.setQueryData(statsDailyDetailQueryKey(dateKey), buildResumedIncompleteDailyDetail());

    const { result } = renderHook(
      () =>
        useStatsMetrics({
          start: new Date(2026, 3, 25),
          end: new Date(2026, 3, 25),
          todayKey: "2026-04-26",
          enabled: true,
        }),
      { wrapper: createWrapper(queryClient) }
    );

    await waitFor(() => {
      expect(result.current.time.totalFocus).toBe(60);
      expect(result.current.focusResume.averageResumesPerTask).toBe(1);
      expect(result.current.focusResume.averageFocusSegmentMinutes).toBe(30);
    });
  });
});
