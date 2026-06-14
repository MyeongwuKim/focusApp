const fs = require("node:fs");
const path = require("node:path");

const appRoot = path.resolve(__dirname, "..");
const variant = (process.argv[2] || process.env.APP_VARIANT || "test").trim().toLowerCase();
const appJsonPath = path.join(appRoot, "app.json");
const configPath = path.join(appRoot, "native-version.config.json");

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

function resolvePlatformVersion(appJson, platformConfig, label) {
  if (platformConfig?.versionSource === "expo") {
    const expoVersion = appJson.expo?.version;
    if (typeof expoVersion !== "string" || !expoVersion.trim()) {
      throw new Error("expo.version is missing in app.json.");
    }
    return expoVersion.trim();
  }

  if (typeof platformConfig?.version !== "string" || !platformConfig.version.trim()) {
    throw new Error(`native-version.config.json ${label}.version is missing.`);
  }

  return platformConfig.version.trim();
}

function resolveVariantConfig(versionConfig) {
  const variantConfig = versionConfig[variant];
  if (!variantConfig) {
    throw new Error(`Unknown native version variant: ${variant}`);
  }
  return variantConfig;
}

function syncIos(version, iosConfig) {
  const projectPath = path.join(appRoot, "ios", "app.xcodeproj", "project.pbxproj");
  const plistPath = path.join(appRoot, "ios", "app", "Info.plist");
  if (!fs.existsSync(projectPath) || !fs.existsSync(plistPath)) {
    console.log("[native-version] iOS project not found. Skipped.");
    return;
  }

  const buildNumber = iosConfig?.buildNumber;
  let projectContent = fs.readFileSync(projectPath, "utf8");
  projectContent = replaceRequired(
    projectContent,
    /MARKETING_VERSION = [^;]+;/g,
    `MARKETING_VERSION = ${version};`,
    "iOS MARKETING_VERSION"
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

  let plistContent = fs.readFileSync(plistPath, "utf8");
  plistContent = replaceRequired(
    plistContent,
    /(<key>CFBundleShortVersionString<\/key>\s*<string>)[^<]+(<\/string>)/,
    `$1${version}$2`,
    "iOS CFBundleShortVersionString"
  );
  if (buildNumber) {
    plistContent = replaceRequired(
      plistContent,
      /(<key>CFBundleVersion<\/key>\s*<string>)[^<]+(<\/string>)/,
      `$1${buildNumber}$2`,
      "iOS CFBundleVersion"
    );
  }
  const didUpdatePlist = writeIfChanged(plistPath, plistContent);

  console.log(
    `[native-version] iOS ${didUpdateProject || didUpdatePlist ? "updated" : "already synced"}: ${version}${
      buildNumber ? ` (${buildNumber})` : ""
    }`
  );
}

function syncAndroid(version, androidConfig) {
  const gradlePath = path.join(appRoot, "android", "app", "build.gradle");
  if (!fs.existsSync(gradlePath)) {
    console.log("[native-version] Android project not found. Skipped.");
    return;
  }

  const versionCode = androidConfig?.versionCode;
  let gradleContent = fs.readFileSync(gradlePath, "utf8");
  gradleContent = replaceRequired(
    gradleContent,
    /versionName\s+["'][^"']+["']/,
    `versionName "${version}"`,
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

  console.log(
    `[native-version] Android ${didUpdateGradle ? "updated" : "already synced"}: ${version}${
      Number.isInteger(versionCode) ? ` (${versionCode})` : ""
    }`
  );
}

const appJson = readJson(appJsonPath);
const versionConfig = readJson(configPath);
const variantConfig = resolveVariantConfig(versionConfig);
const iosVersion = resolvePlatformVersion(appJson, variantConfig.ios, `${variant}.ios`);
const androidVersion = resolvePlatformVersion(appJson, variantConfig.android, `${variant}.android`);

syncIos(iosVersion, variantConfig.ios);
syncAndroid(androidVersion, variantConfig.android);
