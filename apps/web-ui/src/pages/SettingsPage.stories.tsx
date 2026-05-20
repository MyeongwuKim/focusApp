import type { Meta, StoryObj } from "@storybook/react";
import { SettingsPage } from "./SettingsPage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof SettingsPage> = {
  title: "Pages/SettingsPage",
  component: SettingsPage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry="/settings" activeRoute="settings">
        <Story />
      </PageStoryProviders>
    ),
  ],
  args: {
    forcedPathname: "/settings",
  },
};

export default meta;

type Story = StoryObj<typeof SettingsPage>;

export const Home: Story = {};

export const Theme: Story = {
  args: {
    forcedPathname: "/settings/theme",
  },
};

export const Weather: Story = {
  args: {
    forcedPathname: "/settings/weather",
  },
};

export const Routine: Story = {
  args: {
    forcedPathname: "/routine",
  },
};

export const Notifications: Story = {
  args: {
    forcedPathname: "/settings/notifications",
  },
};

export const Account: Story = {
  args: {
    forcedPathname: "/settings/account",
  },
};
