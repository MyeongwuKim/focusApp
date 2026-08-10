const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");

const appRoot = path.resolve(__dirname, "..");
const variant = (process.argv[2] || process.env.APP_VARIANT || "test").trim().toLowerCase();
const appJsonPath = path.join(appRoot, "app.json");
const configPath = path.join(appRoot, "native.config.json");
const appVersionPath = path.join(appRoot, "app-version.json");
const envFileNamesByVariant = {
  prod: [".env.production", ".env.prod"],
  production: [".env.production", ".env.prod"],
  dev: [".env.test", ".env.dev"],
  test: [".env.test"],
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeIfChanged(filePath, nextContent) {
  const previousContent = fs.readFileSync(filePath, "utf8");
  if (previousContent === nextContent) {
    return false;
  }
  fs.writeFileSync(filePath, nextContent);
  return true;
}

function parseEnvFile(filePath) {
  const values = {};
  const content = fs.readFileSync(filePath, "utf8");

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

function loadEnvFileIfExists(filePath, loadedKeys, options = {}) {
  if (!fs.existsSync(filePath)) {
    return;
  }

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
}

function loadMobileEnvFiles() {
  const loadedKeys = new Set();

  loadEnvFileIfExists(path.join(appRoot, ".env"), loadedKeys);
  loadEnvFileIfExists(path.join(appRoot, ".env.local"), loadedKeys, { overrideLoaded: true });

  const variantEnvFileNames = envFileNamesByVariant[variant] || [`.env.${variant}`];
  for (const fileName of variantEnvFileNames) {
    loadEnvFileIfExists(path.join(appRoot, fileName), loadedKeys, { overrideExisting: true });
  }
  for (const fileName of variantEnvFileNames) {
    loadEnvFileIfExists(path.join(appRoot, `${fileName}.local`), loadedKeys, {
      overrideExisting: true,
    });
  }
}

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Failed to update ${label}. Pattern not found.`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
}

function findExistingFile(candidates) {
  return candidates.find((filePath) => fs.existsSync(filePath)) ?? null;
}

function listChildDirectories(parentPath) {
  if (!fs.existsSync(parentPath)) {
    return [];
  }

  return fs
    .readdirSync(parentPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

function resolveIosProjectFiles() {
  const iosRoot = path.join(appRoot, "ios");
  if (!fs.existsSync(iosRoot)) {
    return null;
  }

  const projectNames = listChildDirectories(iosRoot).filter(
    (name) => name.endsWith(".xcodeproj") && name !== "Pods.xcodeproj"
  );
  const projects = projectNames
    .map((name) => ({
      name,
      baseName: name.replace(/\.xcodeproj$/, ""),
      projectPath: path.join(iosRoot, name, "project.pbxproj"),
    }))
    .filter((project) => fs.existsSync(project.projectPath));

  if (projects.length === 0) {
    return null;
  }

  const appDirectoryNames = listChildDirectories(iosRoot).filter((name) => {
    if (name === "Pods" || name === "build") {
      return false;
    }
    if (name.endsWith(".xcodeproj") || name.endsWith(".xcworkspace")) {
      return false;
    }

    return (
      fs.existsSync(path.join(iosRoot, name, "Info.plist")) &&
      fs.existsSync(path.join(iosRoot, name, "AppDelegate.swift"))
    );
  });

  const preferredProject =
    projects.find((project) => appDirectoryNames.includes(project.baseName)) ?? projects[0];
  const preferredAppDirectoryName =
    appDirectoryNames.find((name) => name === preferredProject.baseName) ?? appDirectoryNames[0];

  if (!preferredAppDirectoryName) {
    return null;
  }

  const appDirectoryPath = path.join(iosRoot, preferredAppDirectoryName);
  const appEntitlementsPath = findExistingFile([
    path.join(appDirectoryPath, `${preferredAppDirectoryName}.entitlements`),
    path.join(appDirectoryPath, "app.entitlements"),
    ...fs
      .readdirSync(appDirectoryPath)
      .filter((name) => name.endsWith(".entitlements"))
      .map((name) => path.join(appDirectoryPath, name)),
  ]);

  return {
    projectName: preferredProject.baseName,
    appDirectoryName: preferredAppDirectoryName,
    projectPath: preferredProject.projectPath,
    plistPath: path.join(appDirectoryPath, "Info.plist"),
    appDelegatePath: path.join(appDirectoryPath, "AppDelegate.swift"),
    appEntitlementsPath,
    widgetEntitlementsPath: path.join(appRoot, "targets", "focus-live-activity", "generated.entitlements"),
  };
}

function replaceIosBundleIdentifiers(projectContent, bundleIdentifier) {
  return replaceRequired(
    projectContent,
    /PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g,
    (_match, currentValue) => {
      const normalizedValue = String(currentValue).trim().replace(/^"|"$/g, "");
      const nextIdentifier = normalizedValue.endsWith(".FocusLiveActivityWidget")
        ? `${bundleIdentifier}.FocusLiveActivityWidget`
        : bundleIdentifier;
      return `PRODUCT_BUNDLE_IDENTIFIER = ${nextIdentifier};`;
    },
    "iOS PRODUCT_BUNDLE_IDENTIFIER"
  );
}

function findSynchronizedRootGroup(group, SynchronizedRootGroup, groupPath) {
  if (SynchronizedRootGroup.is(group) && group.props.path === groupPath) {
    return group;
  }

  for (const child of group.props.children ?? []) {
    const matched = findSynchronizedRootGroup(child, SynchronizedRootGroup, groupPath);
    if (matched) {
      return matched;
    }
  }

  return null;
}

function syncFocusLiveActivityTargetMembership(projectPath) {
  const appleTargetsRoot = path.dirname(
    require.resolve("@bacons/apple-targets/package.json", { paths: [appRoot] })
  );
  const xcode = require(require.resolve("@bacons/xcode", { paths: [appleTargetsRoot] }));
  const xcodeJson = require(
    require.resolve("@bacons/xcode/json", { paths: [appleTargetsRoot] })
  );
  const project = xcode.XcodeProject.open(projectPath);
  const widgetTarget = project.rootObject.props.targets.find(
    (target) =>
      xcode.PBXNativeTarget.is(target) && target.props.name === "FocusLiveActivityWidget"
  );
  const synchronizedGroup = findSynchronizedRootGroup(
    project.rootObject.props.mainGroup,
    xcode.PBXFileSystemSynchronizedRootGroup,
    "focus-live-activity"
  );

  if (!widgetTarget || !synchronizedGroup) {
    throw new Error(
      "FocusLiveActivityWidget target or synchronized source group is missing. Run Expo prebuild first."
    );
  }

  synchronizedGroup.props.exceptions ??= [];
  let exceptionSet = synchronizedGroup.props.exceptions.find(
    (exception) =>
      xcode.PBXFileSystemSynchronizedBuildFileExceptionSet.is(exception) &&
      exception.props.target === widgetTarget
  );
  const requiredExceptions = ["Info.plist", "expo-target.config.js"];
  let didChange = false;

  if (!exceptionSet) {
    exceptionSet = xcode.PBXFileSystemSynchronizedBuildFileExceptionSet.create(project, {
      target: widgetTarget,
      membershipExceptions: requiredExceptions,
    });
    synchronizedGroup.props.exceptions.push(exceptionSet);
    didChange = true;
  } else {
    const nextExceptions = Array.from(
      new Set([...(exceptionSet.props.membershipExceptions ?? []), ...requiredExceptions])
    ).sort();
    if (
      JSON.stringify(nextExceptions) !==
      JSON.stringify(exceptionSet.props.membershipExceptions ?? [])
    ) {
      exceptionSet.props.membershipExceptions = nextExceptions;
      didChange = true;
    }
  }

  if (!didChange) {
    return false;
  }

  return writeIfChanged(projectPath, xcodeJson.build(project.toJSON()));
}

function syncAppGroupEntitlements(filePath, appGroup) {
  if (!filePath || !fs.existsSync(filePath)) {
    return false;
  }

  const escapedAppGroup = escapeXml(appGroup);
  const appGroupBlock = [
    "    <key>com.apple.security.application-groups</key>",
    "    <array>",
    `      <string>${escapedAppGroup}</string>`,
    "    </array>",
  ].join("\n");

  let content = fs.readFileSync(filePath, "utf8");
  if (/<key>com\.apple\.security\.application-groups<\/key>\s*<array>/.test(content)) {
    content = replaceRequired(
      content,
      /\s*<key>com\.apple\.security\.application-groups<\/key>\s*<array>[\s\S]*?<\/array>/,
      `\n${appGroupBlock}`,
      `${path.basename(filePath)} application groups`
    );
  } else {
    content = replaceRequired(
      content,
      /(\s*<\/dict>)/,
      `${appGroupBlock}\n$1`,
      `${path.basename(filePath)} application groups`
    );
  }

  return writeIfChanged(filePath, content);
}

function readConfigString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function resolveVersionEnvironment() {
  if (variant === "test" || variant === "dev") {
    return "dev";
  }
  if (variant === "prod" || variant === "production") {
    return "prod";
  }
  throw new Error(`Unknown native config variant: ${variant}`);
}

function resolveVariantConfig(nativeConfig) {
  const nativeConfigVariant = resolveVersionEnvironment() === "dev" ? "test" : "prod";
  const variantConfig = nativeConfig[nativeConfigVariant];
  if (!variantConfig) {
    throw new Error(`native.config.json ${nativeConfigVariant} config is missing.`);
  }
  return variantConfig;
}

function resolveAppVersion(appVersionConfig, platform) {
  const environment = resolveVersionEnvironment();
  const version = readConfigString(appVersionConfig?.[environment]?.[platform]);
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`app-version.json ${environment}.${platform} must use x.y.z format.`);
  }
  return version;
}

function resolveTargetPlatform() {
  const platform = readConfigString(process.env.APP_PLATFORM).toLowerCase();
  if (!platform) {
    return null;
  }
  if (platform !== "ios" && platform !== "android") {
    throw new Error(`Unknown APP_PLATFORM: ${platform}`);
  }
  return platform;
}

async function confirmAppVersion(input) {
  if (process.argv.includes("--yes")) {
    return true;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "Version confirmation requires an interactive terminal. Pass --yes for an automated run."
    );
  }

  const platformLabel =
    input.platform === "ios"
      ? `iOS ${input.iosVersion}`
      : input.platform === "android"
        ? `Android ${input.androidVersion}`
        : `iOS ${input.iosVersion} / Android ${input.androidVersion}`;
  const prompt = `[native-sync] ${input.environment} ${platformLabel} 패키지를 생성할까요? (y/N) `;
  const terminal = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = (await terminal.question(prompt)).trim().toLowerCase();
    if (answer !== "y" && answer !== "yes") {
      console.log("[native-sync] 패키지 생성을 취소했습니다.");
      return false;
    }
    return true;
  } finally {
    terminal.close();
  }
}

function resolveNativeIdentity(appJson, variantConfig) {
  const appName = readConfigString(variantConfig.appName) || readConfigString(appJson.expo?.name);
  const appScheme =
    readConfigString(process.env.EXPO_PUBLIC_APP_SCHEME) ||
    readConfigString(variantConfig.appScheme) ||
    readConfigString(appJson.expo?.scheme);
  const iosBundleIdentifier =
    readConfigString(variantConfig.ios?.bundleIdentifier) ||
    readConfigString(appJson.expo?.ios?.bundleIdentifier);
  const androidPackage =
    readConfigString(variantConfig.android?.package) ||
    readConfigString(appJson.expo?.android?.package);

  if (!appName) {
    throw new Error(`native.config.json ${variant}.appName is missing.`);
  }
  if (!appScheme) {
    throw new Error(`native.config.json ${variant}.appScheme is missing.`);
  }
  if (!iosBundleIdentifier) {
    throw new Error(`native.config.json ${variant}.ios.bundleIdentifier is missing.`);
  }
  if (!androidPackage) {
    throw new Error(`native.config.json ${variant}.android.package is missing.`);
  }

  return {
    appName,
    appScheme,
    iosBundleIdentifier,
    androidPackage,
  };
}

function resolveProviderIdentity() {
  const naverUrlScheme = readConfigString(process.env.EXPO_PUBLIC_NAVER_URL_SCHEME);
  const kakaoAppKey = readConfigString(process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY);

  if (!naverUrlScheme) {
    throw new Error("EXPO_PUBLIC_NAVER_URL_SCHEME is missing.");
  }
  if (!kakaoAppKey) {
    throw new Error("EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY is missing.");
  }

  return {
    naverUrlScheme,
    kakaoAppKey,
  };
}

function syncIos(input) {
  const iosProjectFiles = resolveIosProjectFiles();
  if (!iosProjectFiles) {
    console.log("[native-sync] iOS project not found. Skipped.");
    return;
  }

  const buildNumber = input.iosConfig?.buildNumber;
  let projectContent = fs.readFileSync(iosProjectFiles.projectPath, "utf8");
  projectContent = replaceRequired(
    projectContent,
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${input.version};`,
    "iOS MARKETING_VERSION"
  );
  projectContent = replaceIosBundleIdentifiers(projectContent, input.bundleIdentifier);
  if (buildNumber) {
    projectContent = replaceRequired(
      projectContent,
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};`,
      "iOS CURRENT_PROJECT_VERSION"
    );
  }
  const didUpdateProject = writeIfChanged(iosProjectFiles.projectPath, projectContent);
  const didUpdateWidgetTargetMembership = syncFocusLiveActivityTargetMembership(
    iosProjectFiles.projectPath
  );

  const escapedAppName = escapeXml(input.appName);
  const escapedAppScheme = escapeXml(input.appScheme);
  const escapedBundleIdentifier = escapeXml(input.bundleIdentifier);
  const escapedNaverUrlScheme = escapeXml(input.naverUrlScheme);
  const escapedKakaoAppKey = escapeXml(input.kakaoAppKey);
  const escapedKakaoUrlScheme = escapeXml(`kakao${input.kakaoAppKey}`);
  const appUrlSchemesBlock = [
    "",
    `          <string>${escapedAppScheme}</string>`,
    `          <string>${escapedBundleIdentifier}</string>`,
    "        ",
  ].join("\n");

  let plistContent = fs.readFileSync(iosProjectFiles.plistPath, "utf8");
  plistContent = replaceRequired(
    plistContent,
    /(<key>CFBundleDisplayName<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${escapedAppName}$2`,
    "iOS CFBundleDisplayName"
  );
  plistContent = replaceRequired(
    plistContent,
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    "$1$(MARKETING_VERSION)$2",
    "iOS CFBundleShortVersionString"
  );
  plistContent = replaceRequired(
    plistContent,
    /(<key>CFBundleURLTypes<\/key>\s*<array>\s*<dict>\s*<key>CFBundleURLSchemes<\/key>\s*<array>)[\s\S]*?(<\/array>\s*<\/dict>)/,
    `$1${appUrlSchemesBlock}$2`,
    "iOS app URL schemes"
  );
  plistContent = replaceRequired(
    plistContent,
    /(<key>CFBundleURLName<\/key>\s*<string>naver<\/string>\s*<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>)[^<]+(<\/string>)/,
    `$1${escapedNaverUrlScheme}$2`,
    "iOS Naver URL scheme"
  );
  plistContent = replaceRequired(
    plistContent,
    /(<dict>\s*<key>CFBundleURLSchemes<\/key>\s*<array>\s*<string>)kakao[^<]+(<\/string>\s*<\/array>\s*<\/dict>)/,
    `$1${escapedKakaoUrlScheme}$2`,
    "iOS Kakao URL scheme"
  );
  plistContent = replaceRequired(
    plistContent,
    /(<key>KAKAO_APP_KEY<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${escapedKakaoAppKey}$2`,
    "iOS Kakao app key"
  );
  if (buildNumber) {
    plistContent = replaceRequired(
      plistContent,
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
      "$1$(CURRENT_PROJECT_VERSION)$2",
      "iOS CFBundleVersion"
    );
  }
  const didUpdatePlist = writeIfChanged(iosProjectFiles.plistPath, plistContent);

  let appDelegateContent = fs.readFileSync(iosProjectFiles.appDelegatePath, "utf8");
  appDelegateContent = replaceRequired(
    appDelegateContent,
    /(url\.scheme == ")[^"]+(")/,
    `$1${input.naverUrlScheme}$2`,
    "iOS Naver AppDelegate URL scheme"
  );
  const didUpdateAppDelegate = writeIfChanged(iosProjectFiles.appDelegatePath, appDelegateContent);
  const appGroup = `group.${input.bundleIdentifier}.focus-live-activity`;
  const didUpdateAppEntitlements = syncAppGroupEntitlements(
    iosProjectFiles.appEntitlementsPath,
    appGroup
  );
  const didUpdateWidgetEntitlements = syncAppGroupEntitlements(
    iosProjectFiles.widgetEntitlementsPath,
    appGroup
  );

  console.log(
    `[native-sync] iOS ${
      didUpdateProject ||
      didUpdateWidgetTargetMembership ||
      didUpdatePlist ||
      didUpdateAppDelegate ||
      didUpdateAppEntitlements ||
      didUpdateWidgetEntitlements
        ? "updated"
        : "already synced"
    } (${iosProjectFiles.projectName}): ${
      input.bundleIdentifier
    }, ${input.appScheme}, ${input.naverUrlScheme}, ${input.version}${
      buildNumber ? ` (${buildNumber})` : ""
    }`
  );
}

function syncAndroid(input) {
  const gradlePath = path.join(appRoot, "android", "app", "build.gradle");
  const manifestPath = path.join(appRoot, "android", "app", "src", "main", "AndroidManifest.xml");
  const stringsPath = path.join(appRoot, "android", "app", "src", "main", "res", "values", "strings.xml");
  if (!fs.existsSync(gradlePath) || !fs.existsSync(manifestPath) || !fs.existsSync(stringsPath)) {
    console.log("[native-sync] Android project not found. Skipped.");
    return;
  }

  const versionCode = input.androidConfig?.versionCode;
  let gradleContent = fs.readFileSync(gradlePath, "utf8");
  gradleContent = replaceRequired(
    gradleContent,
    /applicationId\s+["'][^"']+["']/,
    `applicationId '${input.packageName}'`,
    "Android applicationId"
  );
  gradleContent = replaceRequired(
    gradleContent,
    /versionName\s+["'][^"']+["']/,
    `versionName "${input.version}"`,
    "Android versionName"
  );
  if (Number.isInteger(versionCode)) {
    gradleContent = replaceRequired(
      gradleContent,
      /versionCode\s+\d+/,
      `versionCode ${versionCode}`,
      "Android versionCode"
    );
  }
  const didUpdateGradle = writeIfChanged(gradlePath, gradleContent);

  let manifestContent = fs.readFileSync(manifestPath, "utf8");
  manifestContent = replaceRequired(
    manifestContent,
    /(<intent-filter>\s*<action android:name="android.intent.action.VIEW"\/>\s*<category android:name="android.intent.category.DEFAULT"\/>\s*<category android:name="android.intent.category.BROWSABLE"\/>\s*<data android:scheme=")[^"]+("\/>\s*<\/intent-filter>)/,
    `$1${input.appScheme}$2`,
    "Android app URL scheme"
  );
  const didUpdateManifest = writeIfChanged(manifestPath, manifestContent);

  let stringsContent = fs.readFileSync(stringsPath, "utf8");
  stringsContent = replaceRequired(
    stringsContent,
    /(<string name="app_name">)[^<]+(<\/string>)/,
    `$1${escapeXml(input.appName)}$2`,
    "Android app_name"
  );
  const didUpdateStrings = writeIfChanged(stringsPath, stringsContent);

  console.log(
    `[native-sync] Android ${
      didUpdateGradle || didUpdateManifest || didUpdateStrings ? "updated" : "already synced"
    }: ${input.packageName}, ${input.appScheme}, ${input.version}${
      Number.isInteger(versionCode) ? ` (${versionCode})` : ""
    }`
  );
}

async function main() {
  loadMobileEnvFiles();

  const appJson = readJson(appJsonPath);
  const nativeConfig = readJson(configPath);
  const appVersionConfig = readJson(appVersionPath);
  const variantConfig = resolveVariantConfig(nativeConfig);
  const identity = resolveNativeIdentity(appJson, variantConfig);
  const providerIdentity = resolveProviderIdentity();
  const environment = resolveVersionEnvironment();
  const targetPlatform = resolveTargetPlatform();
  const iosVersion = resolveAppVersion(appVersionConfig, "ios");
  const androidVersion = resolveAppVersion(appVersionConfig, "android");

  const isConfirmed = await confirmAppVersion({
    environment,
    platform: targetPlatform,
    iosVersion,
    androidVersion,
  });
  if (!isConfirmed) {
    process.exitCode = 1;
    return;
  }

  if (!targetPlatform || targetPlatform === "ios") {
    syncIos({
      version: iosVersion,
      iosConfig: variantConfig.ios,
      appName: identity.appName,
      appScheme: identity.appScheme,
      bundleIdentifier: identity.iosBundleIdentifier,
      naverUrlScheme: providerIdentity.naverUrlScheme,
      kakaoAppKey: providerIdentity.kakaoAppKey,
    });
  }

  if (!targetPlatform || targetPlatform === "android") {
    syncAndroid({
      version: androidVersion,
      androidConfig: variantConfig.android,
      appName: identity.appName,
      appScheme: identity.appScheme,
      packageName: identity.androidPackage,
    });
  }
}

main().catch((error) => {
  console.error(`[native-sync] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
