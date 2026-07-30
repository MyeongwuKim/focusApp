import type { Meta, StoryObj } from "@storybook/react";
import { FocusResumeRelationCard } from "./FocusResumeRelationCard";

const meta: Meta<typeof FocusResumeRelationCard> = {
  title: "Stats/FocusResumeRelationCard",
  component: FocusResumeRelationCard,
  args: {
    scope: "all",
    focusMinutes: 160,
    resumeCount: 5,
    averageResumesPerTask: 1,
    averageFocusSegmentMinutes: 16,
    useMonthlyBar: false,
    data: [
      {
        id: "2026-07-23-task-1",
        dateKey: "2026-07-23",
        taskLabel: "기획 정리",
        focusMin: 10,
        resumeCount: 0,
        done: true,
      },
      {
        id: "2026-07-25-task-2",
        dateKey: "2026-07-25",
        taskLabel: "화면 구현",
        focusMin: 20,
        resumeCount: 1,
        done: true,
      },
      {
        id: "2026-07-27-task-3",
        dateKey: "2026-07-27",
        taskLabel: "통계 작업",
        focusMin: 30,
        resumeCount: 1,
        done: false,
      },
      {
        id: "2026-07-29-task-4",
        dateKey: "2026-07-29",
        taskLabel: "테스트 점검",
        focusMin: 60,
        resumeCount: 2,
        done: true,
      },
      {
        id: "2026-07-29-task-5",
        dateKey: "2026-07-29",
        taskLabel: "문서 정리",
        focusMin: 40,
        resumeCount: 1,
        done: true,
      },
    ],
  },
};

export default meta;

type Story = StoryObj<typeof FocusResumeRelationCard>;

export const TaskLevelRelationship: Story = {};

export const Empty: Story = {
  args: {
    focusMinutes: 0,
    resumeCount: 0,
    averageResumesPerTask: null,
    averageFocusSegmentMinutes: null,
    data: [],
  },
};
