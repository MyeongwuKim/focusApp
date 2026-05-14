import type { StorybookConfig } from "@storybook/react-vite";
import { mergeConfig } from "vite";
import baseViteConfig from "../vite.config";

const config: StorybookConfig = {
  stories: ["../src/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-essentials"],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  async viteFinal(config) {
    const baseConfigObject = baseViteConfig as {
      resolve?: Record<string, unknown>;
      define?: Record<string, unknown>;
      css?: Record<string, unknown>;
    };

    // Storybook에는 앱용 base/server/proxy 설정을 섞지 않고,
    // 필요한 alias/define/css 설정만 가져온다.
    return mergeConfig(config, {
      resolve: baseConfigObject.resolve,
      define: baseConfigObject.define,
      css: baseConfigObject.css,
    });
  },
};

export default config;
