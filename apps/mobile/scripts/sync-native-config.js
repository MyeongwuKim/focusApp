const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const variant = (process.argv[2] || process.env.APP_VARIANT || "test").trim().toLowerCase();
const appJsonPath = path.join(appRoot, "app.json");
const configPath = path.join(appRoot, "native.config.json");

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

function replaceRequired(content, pattern, replacement, label) {
  if (!pattern.test(content)) {
    throw new Error(`Failed to update ${label}. Pattern not found.`);
  }
  pattern.lastIndex = 0;
  return content.replace(pattern, replacement);
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

function resolvePlatformVersion(appJson, platformConfig, label) {
  if (platformConfig?.versionSource === "expo") {
    const expoVersion = appJson.expo?.version;
    if (typeof expoVersion !== "string" || !expoVersion.trim()) {
      throw new Error("expo.version is missing in app.json.");
    }
    return expoVersion.trim();
  }

  if (typeof platformConfig?.version !== "string" || !platformConfig.version.trim()) {
    throw new Error(`native.config.json ${label}.version is missing.`);
  }

  return platformConfig.version.trim();
}

function resolveVariantConfig(nativeConfig) {
  const variantConfig = nativeConfig[variant];
  if (!variantConfig) {
    throw new Error(`Unknown native config variant: ${variant}`);
  }
  return variantConfig;
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

function syncIos(input) {
  const projectPath = path.join(appRoot, "ios", "app.xcodeproj", "project.pbxproj");
  const plistPath = path.join(appRoot, "ios", "app", "Info.plist");
  if (!fs.existsSync(projectPath) || !fs.existsSync(plistPath)) {
    console.log("[native-sync] iOS project not found. Skipped.");
    return;
  }

  const buildNumber = input.iosConfig?.buildNumber;
  let projectContent = fs.readFileSync(projectPath, "utf8");
  projectContent = replaceRequired(
    projectContent,
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${input.version};`,
    "iOS MARKETING_VERSION"
  );
  projectContent = replaceRequired(
    projectContent,
    /PRODUCT_BUNDLE_IDENTIFIER = [^;]+;/g,
    `PRODUCT_BUNDLE_IDENTIFIER = ${input.bundleIdentifier};`,
    "iOS PRODUCT_BUNDLE_IDENTIFIER"
  );
  if (buildNumber) {
    projectContent = replaceRequired(
      projectContent,
      /CURRENT_PROJECT_VERSION = [^;]+;/g,
      `CURRENT_PROJECT_VERSION = ${buildNumber};`,
      "iOS CURRENT_PROJECT_VERSION"
    );
  }
  const didUpdateProject = writeIfChanged(projectPath, projectContent);

  const escapedAppName = escapeXml(input.appName);
  const escapedAppScheme = escapeXml(input.appScheme);
  const escapedBundleIdentifier = escapeXml(input.bundleIdentifier);
  const appUrlSchemesBlock = [
    "",
    `          <string>${escapedAppScheme}</string>`,
    `          <string>${escapedBundleIdentifier}</string>`,
    "        ",
  ].join("\n");

  let plistContent = fs.readFileSync(plistPath, "utf8");
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
  if (buildNumber) {
    plistContent = replaceRequired(
      plistContent,
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
      "$1$(CURRENT_PROJECT_VERSION)$2",
      "iOS CFBundleVersion"
    );
  }
  const didUpdatePlist = writeIfChanged(plistPath, plistContent);

  console.log(
    `[native-sync] iOS ${didUpdateProject || didUpdatePlist ? "updated" : "already synced"}: ${
      input.bundleIdentifier
    }, ${input.appScheme}, ${input.version}${buildNumber ? ` (${buildNumber})` : ""}`
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

const appJson = readJson(appJsonPath);
const nativeConfig = readJson(configPath);
const variantConfig = resolveVariantConfig(nativeConfig);
const identity = resolveNativeIdentity(appJson, variantConfig);
const iosVersion = resolvePlatformVersion(appJson, variantConfig.ios, `${variant}.ios`);
const androidVersion = resolvePlatformVersion(appJson, variantConfig.android, `${variant}.android`);

syncIos({
  version: iosVersion,
  iosConfig: variantConfig.ios,
  appName: identity.appName,
  appScheme: identity.appScheme,
  bundleIdentifier: identity.iosBundleIdentifier,
});
syncAndroid({
  version: androidVersion,
  androidConfig: variantConfig.android,
  appName: identity.appName,
  appScheme: identity.appScheme,
  packageName: identity.androidPackage,
});
