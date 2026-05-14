import type { Meta, StoryObj } from "@storybook/react";
import { DateTodosRoutePage } from "./DateTodosRoutePage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { pageStoryDateKeys, seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof DateTodosRoutePage> = {
  title: "Pages/DateTodosRoutePage",
  component: DateTodosRoutePage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry={`/date-tasks?date=${pageStoryDateKeys.today}`} activeRoute="dateTasks">
        <Story />
      </PageStoryProviders>
    ),
  ],
  args: {
    forcedPathname: "/date-tasks",
    forcedSearch: `?date=${pageStoryDateKeys.today}`,
  },
};

export default meta;

type Story = StoryObj<typeof DateTodosRoutePage>;

export const Main: Story = {};

export const TaskPickerRoute: Story = {
  args: {
    forcedPathname: "/date-tasks/add",
    forcedSearch: `?date=${pageStoryDateKeys.today}`,
  },
};

export const MemoRoute: Story = {
  args: {
    forcedPathname: "/date-tasks/memo",
    forcedSearch: `?date=${pageStoryDateKeys.today}`,
  },
};

export const RoutineImportRoute: Story = {
  args: {
    forcedPathname: "/date-tasks/routines",
    forcedSearch: `?date=${pageStoryDateKeys.today}`,
  },
};
