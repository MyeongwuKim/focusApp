import type { ConfigContext, ExpoConfig } from "expo/config";

const KAKAO_MAVEN_REPO = "https://devrepo.kakao.com/nexus/content/groups/public/";

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
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  const naverConsumerKey = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim();
  const naverConsumerSecret = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim();
  const naverUrlScheme = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim();
  const plugins = [...(config.plugins ?? [])];

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
    plugins,
  } as ExpoConfig;
};
