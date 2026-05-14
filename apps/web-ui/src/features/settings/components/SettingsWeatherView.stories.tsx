import type { Meta, StoryObj } from "@storybook/react";

function WeatherStoryProbe() {
  return (
    <div className="space-y-2 rounded-xl border border-base-300/80 bg-base-100/75 p-4 text-sm text-base-content">
      <p className="m-0 font-semibold">SettingsWeatherView Story Probe</p>
      <p className="m-0 text-base-content/70">스토리 모듈 로딩 체크용 최소 렌더</p>
    </div>
  );
}

const meta: Meta<typeof WeatherStoryProbe> = {
  title: "Settings/WeatherView",
  component: WeatherStoryProbe,
};

export default meta;

type Story = StoryObj<typeof WeatherStoryProbe>;

export const Default: Story = {};

export const Primary: Story = {};
