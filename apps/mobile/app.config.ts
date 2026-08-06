import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

const KAKAO_MAVEN_REPO = "https://devrepo.kakao.com/nexus/content/groups/public/";
const APP_ROOT = process.cwd();
const PROD_APP_NAME = "타임스택";
const TEST_APP_NAME = "타임스택 (T)";
const PROD_PROJECT_NAME = "timestack";
const TEST_PROJECT_NAME = "timestackT";
const PROD_BUNDLE_ID = "com.myeongwu.focushybrid";
const TEST_BUNDLE_ID = "com.myeongwu.focushybrid.t";
const PROD_ANDROID_PACKAGE = "com.myeongwu.focushybrid";
const TEST_ANDROID_PACKAGE = "com.myeongwu.focushybrid.t";
const PROD_APP_SCHEME = "mobile";
const TEST_APP_SCHEME = "mobile-test";
const NATIVE_CONFIG_FILE = join(APP_ROOT, "native.config.json");
const APP_VERSION_FILE = join(APP_ROOT, "app-version.json");
const ENV_FILE_NAMES_BY_VARIANT: Record<string, string[]> = {
  prod: [".env.production", ".env.prod"],
  production: [".env.production", ".env.prod"],
  dev: [".env.test", ".env.dev"],
  test: [".env.test"],
};

type NativePlatformConfig = {
  buildNumberSource?: string;
  buildNumber?: string;
  versionCodeSource?: string;
  versionCode?: number;
  bundleIdentifier?: string;
  package?: string;
};

type NativeVariantConfig = {
  projectName?: string;
  appName?: string;
  appScheme?: string;
  ios?: NativePlatformConfig;
  android?: NativePlatformConfig;
};

type NativeConfig = {
  test?: NativeVariantConfig;
  prod?: NativeVariantConfig;
};

type AppVersionEnvironment = "dev" | "prod";

type AppVersionConfig = Record<
  AppVersionEnvironment,
  {
    ios: string;
    android: string;
  }
>;

function parseEnvFile(filePath: string) {
  const values: Record<string, string> = {};
  const content = readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();
    const quote = value[0];
    if ((quote === "\"" || quote === "'") && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "").trim();
    }

    values[key] = value;
  }

  return values;
}

function loadEnvFileIfExists(
  filePath: string,
  loadedKeys: Set<string>,
  options: { overrideExisting?: boolean; overrideLoaded?: boolean } = {}
) {
  if (!existsSync(filePath)) {
    return;
  }

  try {
    const values = parseEnvFile(filePath);
    for (const [key, value] of Object.entries(values)) {
      if (
        options.overrideExisting ||
        process.env[key] === undefined ||
        (options.overrideLoaded && loadedKeys.has(key))
      ) {
        process.env[key] = value;
        loadedKeys.add(key);
      }
    }
  } catch {
    // Ignore malformed/optional local env files and continue with existing process.env.
  }
}

function resolveAppVariant() {
  return process.env.APP_VARIANT?.trim().toLowerCase() || "test";
}

function loadMobileEnvFiles() {
  const loadedKeys = new Set<string>();

  loadEnvFileIfExists(join(APP_ROOT, ".env"), loadedKeys);
  loadEnvFileIfExists(join(APP_ROOT, ".env.local"), loadedKeys, { overrideLoaded: true });

  const appVariant = resolveAppVariant();
  const variantEnvFileNames = ENV_FILE_NAMES_BY_VARIANT[appVariant] ?? [`.env.${appVariant}`];
  for (const fileName of variantEnvFileNames) {
    loadEnvFileIfExists(join(APP_ROOT, fileName), loadedKeys, { overrideExisting: true });
  }
  for (const fileName of variantEnvFileNames) {
    loadEnvFileIfExists(join(APP_ROOT, `${fileName}.local`), loadedKeys, { overrideExisting: true });
  }
}

loadMobileEnvFiles();

function loadNativeConfig(): NativeConfig {
  if (!existsSync(NATIVE_CONFIG_FILE)) {
    return {};
  }

  try {
    return JSON.parse(readFileSync(NATIVE_CONFIG_FILE, "utf8")) as NativeConfig;
  } catch {
    return {};
  }
}

function loadAppVersionConfig(): AppVersionConfig {
  if (!existsSync(APP_VERSION_FILE)) {
    throw new Error("[mobile] app-version.json is missing.");
  }

  try {
    return JSON.parse(readFileSync(APP_VERSION_FILE, "utf8")) as AppVersionConfig;
  } catch {
    throw new Error("[mobile] app-version.json is invalid JSON.");
  }
}

function readConfigString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function resolveVersionEnvironment(appVariant: string): AppVersionEnvironment {
  if (appVariant === "test" || appVariant === "dev") {
    return "dev";
  }
  if (appVariant === "prod" || appVariant === "production") {
    return "prod";
  }
  throw new Error(`[mobile] Unknown APP_VARIANT: ${appVariant}`);
}

function resolveExpoVersion(appVersionConfig: AppVersionConfig, environment: AppVersionEnvironment) {
  const iosVersion = readConfigString(appVersionConfig[environment]?.ios);
  const androidVersion = readConfigString(appVersionConfig[environment]?.android);
  const semverPattern = /^\d+\.\d+\.\d+$/;

  if (!semverPattern.test(iosVersion) || !semverPattern.test(androidVersion)) {
    throw new Error(
      `[mobile] app-version.json ${environment}.ios and ${environment}.android must use x.y.z format.`
    );
  }

  const buildPlatform = (
    process.env.EAS_BUILD_PLATFORM?.trim() || process.env.APP_PLATFORM?.trim() || ""
  ).toLowerCase();
  if (buildPlatform === "ios") {
    return iosVersion;
  }
  if (buildPlatform === "android") {
    return androidVersion;
  }

  if (iosVersion !== androidVersion) {
    throw new Error(
      `[mobile] app-version.json ${environment} iOS and Android versions differ. Set APP_PLATFORM or EAS_BUILD_PLATFORM.`
    );
  }

  return iosVersion;
}

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
  const appVariant = resolveAppVariant();
  const versionEnvironment = resolveVersionEnvironment(appVariant);
  const isTestVariant = versionEnvironment === "dev";
  const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY?.trim();
  const naverConsumerKey = process.env.EXPO_PUBLIC_NAVER_CONSUMER_KEY?.trim();
  const naverConsumerSecret = process.env.EXPO_PUBLIC_NAVER_CONSUMER_SECRET?.trim();
  const naverUrlScheme = process.env.EXPO_PUBLIC_NAVER_URL_SCHEME?.trim();
  const plugins = [...(config.plugins ?? [])];
  const nativeConfig = loadNativeConfig();
  const appVersionConfig = loadAppVersionConfig();
  const variantConfig = isTestVariant ? nativeConfig.test : nativeConfig.prod;
  const projectName =
    readConfigString(variantConfig?.projectName) ||
    (isTestVariant ? TEST_PROJECT_NAME : PROD_PROJECT_NAME);
  const appName =
    readConfigString(variantConfig?.appName) || (isTestVariant ? TEST_APP_NAME : PROD_APP_NAME);
  const iosBundleIdentifier =
    readConfigString(variantConfig?.ios?.bundleIdentifier) ||
    (isTestVariant ? TEST_BUNDLE_ID : PROD_BUNDLE_ID);
  const focusLiveActivityAppGroup = `group.${iosBundleIdentifier}.focus-live-activity`;
  const existingIosEntitlements = (config.ios?.entitlements ?? {}) as Record<string, unknown>;
  const existingIosAppGroups = Array.isArray(
    existingIosEntitlements["com.apple.security.application-groups"]
  )
    ? existingIosEntitlements["com.apple.security.application-groups"].filter(
        (value): value is string => typeof value === "string" && Boolean(value.trim())
      )
    : [];
  const androidPackage =
    readConfigString(variantConfig?.android?.package) ||
    (isTestVariant ? TEST_ANDROID_PACKAGE : PROD_ANDROID_PACKAGE);
  const appScheme =
    process.env.EXPO_PUBLIC_APP_SCHEME?.trim() ||
    readConfigString(variantConfig?.appScheme) ||
    (isTestVariant ? TEST_APP_SCHEME : PROD_APP_SCHEME);
  const appVersion = resolveExpoVersion(appVersionConfig, versionEnvironment);
  const testVersionConfig = isTestVariant ? nativeConfig.test : undefined;
  const testIosBuildNumber = testVersionConfig?.ios?.buildNumber?.trim();
  const testAndroidVersionCode = testVersionConfig?.android?.versionCode;

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

  if (!hasPlugin(plugins, "expo-apple-authentication")) {
    plugins.push("expo-apple-authentication");
  }

  if (!hasPlugin(plugins, "@bacons/apple-targets")) {
    plugins.push("@bacons/apple-targets");
  }

  if (!hasPlugin(plugins, "./plugins/with-focus-live-activity")) {
    plugins.push("./plugins/with-focus-live-activity");
  }

  if (!hasPlugin(plugins, "./plugins/with-native-display-name")) {
    plugins.push([
      "./plugins/with-native-display-name",
      {
        displayName: appName,
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
    name: projectName,
    scheme: appScheme,
    version: appVersion,
    extra: {
      ...(config.extra ?? {}),
      nativeDisplayName: appName,
    },
    ios: {
      ...(config.ios ?? {}),
      appleTeamId: "23598J95N3",
      bundleIdentifier: iosBundleIdentifier,
      usesAppleSignIn: true,
      entitlements: {
        ...existingIosEntitlements,
        "com.apple.security.application-groups": Array.from(
          new Set([...existingIosAppGroups, focusLiveActivityAppGroup])
        ),
      },
      infoPlist: {
        ...(config.ios?.infoPlist ?? {}),
        NSSupportsLiveActivities: true,
      },
      ...(testIosBuildNumber ? { buildNumber: testIosBuildNumber } : {}),
    },
    android: {
      ...(config.android ?? {}),
      package: androidPackage,
      ...(Number.isInteger(testAndroidVersionCode) ? { versionCode: testAndroidVersionCode } : {}),
    },
    plugins,
  } as ExpoConfig;
};
