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

function buildDailyDetail(done: boolean): NonNullable<DailyLogByDate> {
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
        pausedAt: null,
        completedAt: done ? "2026-04-25T09:00:00.000Z" : null,
        deviationSeconds: 0,
        actualFocusSeconds: done ? 3600 : null,
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
});
