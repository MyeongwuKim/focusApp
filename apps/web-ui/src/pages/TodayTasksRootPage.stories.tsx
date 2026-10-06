import type { Meta, StoryObj } from "@storybook/react";
import { TodayTasksRootPage } from "./TodayTasksRootPage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { pageStoryDateKeys, seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof TodayTasksRootPage> = {
  title: "Pages/TodayTasksRootPage",
  component: TodayTasksRootPage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders
        initialEntry={`/date-tasks?date=${pageStoryDateKeys.today}`}
        activeRoute="dateTasks"
      >
        <Story />
      </PageStoryProviders>
    ),
  ],
  args: {
    isActive: true,
    search: `?date=${pageStoryDateKeys.today}`,
  },
};

export default meta;

type Story = StoryObj<typeof TodayTasksRootPage>;

export const Main: Story = {};
