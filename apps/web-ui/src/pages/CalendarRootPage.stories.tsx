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
        <div className="sketchbook-page sketchbook-page--calendar flex min-h-0 flex-1 flex-col">
          <Story />
        </div>
      </PageStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof CalendarRootPage>;

export const Main: Story = {};
