import { useMemo, type ReactNode } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { StatsCommentaryPayload } from "../../../api/statsCommentaryApi";
import { StatsAiCommentaryCard } from "./StatsAiCommentaryCard";

const basePayload: StatsCommentaryPayload = {
  period: {
    preset: "week",
    start: "2026-05-05",
    end: "2026-05-11",
    days: 7,
  },
  totals: {
    doneCount: 26,
    incompleteCount: 8,
    focusMinutes: 540,
    resumeCount: 6,
    restMinutes: 188,
  },
  rates: {
    completionRate: 76.5,
    incompleteRate: 23.5,
  },
  frequentIncompleteTasks: [
    { label: "운동", count: 3 },
    { label: "독서", count: 2 },
  ],
  meta: {
    activeDays: 6,
    daysWithTodos: 6,
    daysWithFocus: 5,
    daysWithIncomplete: 4,
    firstActiveDate: "2026-05-05",
    lastActiveDate: "2026-05-11",
    dataCoverageRate: 85.7,
    avgDonePerActiveDay: 4.3,
    avgIncompletePerActiveDay: 1.3,
  },
};

function QueryProvider({ children }: { children: ReactNode }) {
  const queryClient = useMemo(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
          },
        },
      }),
    []
  );
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const meta: Meta<typeof StatsAiCommentaryCard> = {
  title: "Stats/AiCommentaryCard",
  component: StatsAiCommentaryCard,
  decorators: [
    (Story) => (
      <QueryProvider>
        <Story />
      </QueryProvider>
    ),
  ],
  args: {
    payload: basePayload,
    canUseCommentary: false,
    isDataFetching: false,
  },
};

export default meta;

type Story = StoryObj<typeof StatsAiCommentaryCard>;

export const EmptyGuide: Story = {};

export const WaitingUntilVisible: Story = {
  args: {
    canUseCommentary: true,
    isDataFetching: true,
  },
};
