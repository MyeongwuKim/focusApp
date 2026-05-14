import type { Meta, StoryObj } from "@storybook/react";
import { LoginPage } from "./LoginPage";
import { PageStoryProviders } from "./storybook/PageStoryProviders";
import { seedPageStoryData } from "./storybook/pageStorySeed";

const meta: Meta<typeof LoginPage> = {
  title: "Pages/LoginPage",
  component: LoginPage,
  loaders: [
    async () => {
      seedPageStoryData();
      return {};
    },
  ],
  decorators: [
    (Story) => (
      <PageStoryProviders initialEntry="/login" activeRoute="calendar">
        <Story />
      </PageStoryProviders>
    ),
  ],
};

export default meta;

type Story = StoryObj<typeof LoginPage>;

export const Default: Story = {};
