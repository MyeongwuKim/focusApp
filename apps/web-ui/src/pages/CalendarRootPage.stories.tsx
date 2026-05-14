import type { Meta, StoryObj } from "@storybook/react";
import { CalendarRootPage } from "./CalendarRootPage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof CalendarRootPage> = {
  title: "Pages/CalendarRootPage",
  component: CalendarRootPage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry="/calendar" activeRoute="calendar">
        <Story />
      </PageStoryProviders>
    ),
  ],
  args: {
    isOverlayActive: false,
  },
};

export default meta;

type Story = StoryObj<typeof CalendarRootPage>;

export const Main: Story = {};

export const DateSheetOpenedFromRoute: Story = {
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry="/calendar?sheet=1&date=2026-05-13" activeRoute="calendar">
        <Story />
      </PageStoryProviders>
    ),
  ],
};
