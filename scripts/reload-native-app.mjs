import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const metroPort = Number(process.env.METRO_PORT || 8081);
const requestedPlatform = process.env.NATIVE_SYNC_PLATFORM?.trim().toLowerCase();
const nativeConfig = JSON.parse(
  readFileSync(path.join(repositoryRoot, "apps/mobile/native.config.json"), "utf8")
);
const iosBundleIdentifier =
  process.env.IOS_APP_BUNDLE_ID?.trim() || nativeConfig.test?.ios?.bundleIdentifier;
const androidPackage =
  process.env.ANDROID_APP_PACKAGE?.trim() || nativeConfig.test?.android?.package;

if (requestedPlatform && requestedPlatform !== "ios" && requestedPlatform !== "android") {
  throw new Error("NATIVE_SYNC_PLATFORM은 ios 또는 android만 사용할 수 있습니다.");
}

async function assertMetroIsRunning() {
  try {
    const response = await fetch(`http://localhost:${metroPort}/status`);
    const body = await response.text();
    if (response.ok && body.includes("packager-status:running")) {
      return;
    }
  } catch {
    // 아래의 공통 오류로 처리합니다.
  }

  throw new Error(`Metro ${metroPort}가 실행 중이지 않습니다.`);
}

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    ...options,
  });
}

function readConnectedIosDevices() {
  if (process.platform !== "darwin" || requestedPlatform === "android") {
    return [];
  }

  const tempDirectory = mkdtempSync(path.join(tmpdir(), "focus-native-sync-"));
  const jsonOutputPath = path.join(tempDirectory, "devices.json");

  try {
    const result = run("xcrun", ["devicectl", "list", "devices", "--json-output", jsonOutputPath]);
    if (result.status !== 0) {
      return [];
    }

    const payload = JSON.parse(readFileSync(jsonOutputPath, "utf8"));
    let devices = (payload.result?.devices ?? []).filter(
      (device) =>
        device.hardwareProperties?.platform === "iOS" &&
        device.hardwareProperties?.reality === "physical" &&
        device.connectionProperties?.tunnelState === "connected"
    );
    const explicitDeviceId = process.env.IOS_DEVICE_UDID?.trim();
    if (explicitDeviceId) {
      devices = devices.filter(
        (device) =>
          device.identifier === explicitDeviceId ||
          device.hardwareProperties?.udid === explicitDeviceId
      );
    }
    return devices;
  } finally {
    rmSync(tempDirectory, { recursive: true, force: true });
  }
}

function restartIosApps() {
  if (!iosBundleIdentifier) {
    return { count: 0, errors: [] };
  }

  const devices = readConnectedIosDevices();
  const errors = [];
  let count = 0;

  for (const device of devices) {
    const deviceName = device.deviceProperties?.name || device.identifier;
    console.log(`[native-sync-web] iOS 앱 재시작: ${deviceName}`);
    const result = run(
      "xcrun",
      [
        "devicectl",
        "device",
        "process",
        "launch",
        "--device",
        device.identifier,
        "--terminate-existing",
        iosBundleIdentifier,
      ],
      { stdio: "inherit" }
    );

    if (result.status === 0) {
      count += 1;
    } else {
      errors.push(`${deviceName} iOS 앱 재시작 실패`);
    }
  }

  return { count, errors };
}

function resolveAdbCommand() {
  const sdkRoot = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  const candidates = [sdkRoot ? path.join(sdkRoot, "platform-tools", "adb") : null, "adb"];

  for (const candidate of candidates) {
    if (!candidate || (candidate !== "adb" && !existsSync(candidate))) {
      continue;
    }
    const result = run(candidate, ["version"]);
    if (!result.error && result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function readConnectedAndroidDevices(adbCommand) {
  const result = run(adbCommand, ["devices"]);
  if (result.status !== 0) {
    return [];
  }

  let serials = result.stdout
    .split(/\r?\n/)
    .map((line) => /^(\S+)\s+device$/.exec(line)?.[1] ?? null)
    .filter(Boolean);
  const explicitSerial = process.env.ANDROID_SERIAL?.trim();
  if (explicitSerial) {
    serials = serials.filter((serial) => serial === explicitSerial);
  }
  return serials;
}

function restartAndroidApps() {
  if (requestedPlatform === "ios" || !androidPackage) {
    return { count: 0, errors: [] };
  }

  const adbCommand = resolveAdbCommand();
  if (!adbCommand) {
    return { count: 0, errors: [] };
  }

  const errors = [];
  let count = 0;

  for (const serial of readConnectedAndroidDevices(adbCommand)) {
    const prefix = ["-s", serial];
    const packageInfo = run(adbCommand, [...prefix, "shell", "pm", "path", androidPackage]);
    if (packageInfo.status !== 0 || !packageInfo.stdout.includes("package:")) {
      continue;
    }

    console.log(`[native-sync-web] Android 앱 재시작: ${serial}`);
    const stopped = run(adbCommand, [...prefix, "shell", "am", "force-stop", androidPackage]);
    const launched = run(adbCommand, [
      ...prefix,
      "shell",
      "monkey",
      "-p",
      androidPackage,
      "-c",
      "android.intent.category.LAUNCHER",
      "1",
    ]);

    if (stopped.status === 0 && launched.status === 0) {
      count += 1;
    } else {
      errors.push(`${serial} Android 앱 재시작 실패`);
    }
  }

  return { count, errors };
}

await assertMetroIsRunning();
const iosResult = restartIosApps();
const androidResult = restartAndroidApps();
const restartedCount = iosResult.count + androidResult.count;
const errors = [...iosResult.errors, ...androidResult.errors];

if (restartedCount === 0) {
  throw new Error(
    errors[0] || "실행할 test 앱이 설치된 iOS 또는 Android 기기를 찾지 못했습니다."
  );
}
if (errors.length > 0) {
  throw new Error(errors.join("\n"));
}

console.log(`[native-sync-web] ${restartedCount}개 기기에 최신 Web UI 번들 반영 완료`);
