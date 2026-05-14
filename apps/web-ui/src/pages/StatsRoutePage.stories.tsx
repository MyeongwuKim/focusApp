import type { Meta, StoryObj } from "@storybook/react";
import { StatsRoutePage } from "./StatsRoutePage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof StatsRoutePage> = {
  title: "Pages/StatsRoutePage",
  component: StatsRoutePage,
  render: () => <StatsRoutePage />,
  argTypes: {
    forcedSearch: {
      control: false,
      table: {
        disable: true,
      },
    },
  },
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story, context) => (
      <PageStoryProviders
        initialEntry={
          (context.parameters.initialEntry as string | undefined) ??
          "/stats?preset=7d&start=2026-05-07&end=2026-05-13"
        }
        activeRoute="stats"
      >
        <Story />
      </PageStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof StatsRoutePage>;

export const SevenDays: Story = {
  parameters: {
    initialEntry: "/stats?preset=7d&start=2026-05-07&end=2026-05-13",
  },
};

export const ThirtyDays: Story = {
  parameters: {
    initialEntry: "/stats?preset=30d&start=2026-04-14&end=2026-05-13",
  },
};

export const OneYear: Story = {
  parameters: {
    initialEntry: "/stats?preset=1y&start=2025-05-14&end=2026-05-13",
  },
};
