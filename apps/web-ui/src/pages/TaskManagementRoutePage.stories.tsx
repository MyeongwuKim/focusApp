import type { Meta, StoryObj } from "@storybook/react";
import { TaskManagementRoutePage } from "./TaskManagementRoutePage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof TaskManagementRoutePage> = {
  title: "Pages/TaskManagementRoutePage",
  component: TaskManagementRoutePage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry="/tasks" activeRoute="tasks">
        <Story />
      </PageStoryProviders>
    ),
  ],
  args: {
    forcedPathname: "/tasks",
    forcedSearch: "",
  },
};

export default meta;

type Story = StoryObj<typeof TaskManagementRoutePage>;

export const Main: Story = {};

export const StatsRoute: Story = {
  args: {
    forcedPathname: "/tasks/stats",
    forcedSearch: "?taskId=task-ui&taskLabel=UI%20마감&preset=7d&start=2026-05-07&end=2026-05-13",
  },
};
