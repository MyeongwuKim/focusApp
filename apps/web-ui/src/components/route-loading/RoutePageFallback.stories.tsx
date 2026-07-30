import type { Meta, StoryObj } from "@storybook/react";
import { RoutePageFallback } from "./RoutePageFallback";

const meta = {
  title: "Components/RoutePageFallback",
  component: RoutePageFallback,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <main className="app-root bg-base-200 p-3">
        <section className="app-shell mx-auto flex h-full w-full flex-col overflow-hidden border border-base-300 bg-base-100 p-1.5">
          <header className="mb-2 flex h-12 shrink-0 items-center rounded-2xl border border-base-300/80 bg-base-200/50 px-3">
            <div className="h-8 w-8 rounded-full border border-base-300/65 bg-base-200/55" />
            <div className="mx-auto h-4 w-24 rounded bg-base-200/55" />
            <div className="h-8 w-8 rounded-full border border-base-300/65 bg-base-200/55" />
          </header>
          <div className="relative min-h-0 flex flex-1 flex-col overflow-hidden">
            <Story />
          </div>
        </section>
      </main>
    ),
  ],
} satisfies Meta<typeof RoutePageFallback>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Settings: Story = {
  args: {
    route: "settings",
    forcedPathname: "/settings",
  },
};

export const Routine: Story = {
  args: {
    route: "routine",
    forcedPathname: "/routines",
  },
};

export const Tasks: Story = {
  args: {
    route: "tasks",
    forcedPathname: "/tasks",
  },
};

export const TaskStats: Story = {
  args: {
    route: "tasks",
    forcedPathname: "/tasks/stats",
  },
};

export const Stats: Story = {
  args: {
    route: "stats",
    forcedPathname: "/stats",
  },
};

export const Achievements: Story = {
  args: {
    route: "achievements",
    forcedPathname: "/achievements",
  },
};

export const Memo: Story = {
  args: {
    route: "memo",
    forcedPathname: "/memo",
  },
};
