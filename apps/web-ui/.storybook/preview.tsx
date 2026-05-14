import type { Preview } from "@storybook/react";
import { INITIAL_VIEWPORTS } from "@storybook/addon-viewport";
import "../src/index.css";

const iphone13PlusViewport = {
  name: "iPhone 13 Pro Max",
  styles: {
    width: "428px",
    height: "926px",
  },
  type: "mobile" as const,
};

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    layout: "fullscreen",
    viewport: {
      viewports: {
        ...INITIAL_VIEWPORTS,
        iphone13plus: iphone13PlusViewport,
      },
      defaultViewport: "iphone13plus",
    },
  },
  decorators: [
    (Story) => (
      <div
        data-theme="focus-hybrid"
        className="h-dvh overflow-y-auto bg-base-200 p-4 text-base-content md:p-6"
      >
        <div className="mx-auto flex min-h-full w-full items-start justify-center">
          <div
            className="relative overflow-hidden rounded-[2rem] border border-base-300 bg-base-100 shadow-xl"
            style={{
              width: "min(428px, calc((100dvh - 2rem) * 428 / 926), calc(100vw - 2rem))",
              height: "min(926px, calc(100dvh - 2rem))",
            }}
          >
            <div className="h-full min-h-0 overflow-hidden p-4">
              <Story />
            </div>
          </div>
        </div>
      </div>
    ),
  ],
};

export default preview;
