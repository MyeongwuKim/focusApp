import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import type { ConfigContext, ExpoConfig } from "expo/config";

const KAKAO_MAVEN_REPO = "https://devrepo.kakao.com/nexus/content/groups/public/";
const APP_ROOT = process.cwd();
const PROD_APP_NAME = "타임스택";
const TEST_APP_NAME = "타임스택 (T)";
const PROD_BUNDLE_ID = "com.myeongwu.focushybrid";
const TEST_BUNDLE_ID = "com.myeongwu.focushybrid.t";
const PROD_ANDROID_PACKAGE = "com.myeongwu.focushybrid";
const TEST_ANDROID_PACKAGE = "com.myeongwu.focushybrid.t";

function loadMobileEnvFiles() {
  const candidates = [join(APP_ROOT, ".env"), join(APP_ROOT, ".env.local")];
  for (const filePath of candidates) {
    if (!existsSync(filePath)) {
      continue;
    }
    try {
      loadEnvFile(filePath);
    } catch {
      // Ignore malformed/optional local env files and continue with existing process.env.
    }
  }
}

loadMobileEnvFiles();

function hasPlugin(
  plugins: NonNullable<ExpoConfig["plugins"]>,
  pluginName: string
) {
  return plugins.some((plugin) => {
    if (typeof plugin === "string") {
      return plugin === pluginName;
    }
    if (Array.isArray(plugin)) {
      return plugin[0] === pluginName;
    }
    return false;
  });
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const appVariant = process.env.APP_VARIANT?.trim().toLowerCase() ?? "prod";
  const isTestVariant = appVariant === "test";
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  const naverConsumerKey = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim();
  const naverConsumerSecret = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim();
  const naverUrlScheme = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim();
  const plugins = [...(config.plugins ?? [])];
  const appName = isTestVariant ? TEST_APP_NAME : PROD_APP_NAME;
  const iosBundleIdentifier = isTestVariant ? TEST_BUNDLE_ID : PROD_BUNDLE_ID;
  const androidPackage = isTestVariant ? TEST_ANDROID_PACKAGE : PROD_ANDROID_PACKAGE;

  if (!kakaoAppKey) {
    throw new Error(
      "[mobile] EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is missing. Kakao native login requires this env."
    );
  }

  if (!hasPlugin(plugins, "@react-native-seoul/kakao-login")) {
    plugins.push([
      "@react-native-seoul/kakao-login",
      {
        kakaoAppKey,
      },
    ]);
  }

  if (!naverConsumerKey || !naverConsumerSecret || !naverUrlScheme) {
    throw new Error(
      "[mobile] EXPO_PUBLIC_NAVER_CONSUMER_KEY / EXPO_PUBLIC_NAVER_CONSUMER_SECRET / EXPO_PUBLIC_NAVER_URL_SCHEME are required for Naver native login."
    );
  }

  if (!hasPlugin(plugins, "@react-native-seoul/naver-login")) {
    plugins.push([
      "@react-native-seoul/naver-login",
      {
        urlScheme: naverUrlScheme,
      },
    ]);
  }

  const expoBuildPropertiesPluginIndex = plugins.findIndex((plugin) => {
    if (!Array.isArray(plugin)) {
      return false;
    }
    return plugin[0] === "expo-build-properties";
  });

  if (expoBuildPropertiesPluginIndex >= 0) {
    const current = plugins[expoBuildPropertiesPluginIndex];
    if (Array.isArray(current)) {
      const existingProps = (current[1] ?? {}) as Record<string, unknown>;
      const existingAndroidProps = (existingProps.android ?? {}) as Record<string, unknown>;
      const currentRepos = Array.isArray(existingAndroidProps.extraMavenRepos)
        ? existingAndroidProps.extraMavenRepos
        : [];
      const mergedRepos = Array.from(new Set([...currentRepos, KAKAO_MAVEN_REPO]));

      plugins[expoBuildPropertiesPluginIndex] = [
        "expo-build-properties",
        {
          ...existingProps,
          android: {
            ...existingAndroidProps,
            extraMavenRepos: mergedRepos,
          },
        },
      ];
    }
  } else {
    plugins.push([
      "expo-build-properties",
      {
        android: {
          extraMavenRepos: [KAKAO_MAVEN_REPO],
        },
      },
    ]);
  }

  return {
    ...config,
    name: appName,
    ios: {
      ...(config.ios ?? {}),
      bundleIdentifier: iosBundleIdentifier,
    },
    android: {
      ...(config.android ?? {}),
      package: androidPackage,
    },
    plugins,
  } as ExpoConfig;
};
