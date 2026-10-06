import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDir, "..");
const metroPort = Number(process.env.METRO_PORT || 8081);
const nativeConfig = JSON.parse(
  readFileSync(path.join(repositoryRoot, "apps/mobile/native.config.json"), "utf8")
);
const iosBundleIdentifier =
  process.env.IOS_APP_BUNDLE_ID?.trim() || nativeConfig.test?.ios?.bundleIdentifier;

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

/**
 * 현재 부팅된 iOS 시뮬레이터 중 test 앱이 설치된 기기를 반환한다.
 * IOS_DEVICE_UDID가 지정되면 해당 시뮬레이터만 확인하며, simctl 조회 실패는 빈 목록으로 처리한다.
 */
function readBootedIosSimulators() {
  if (process.platform !== "darwin") {
    return [];
  }

  const result = run("xcrun", ["simctl", "list", "devices", "booted", "--json"]);
  if (result.status !== 0) {
    return [];
  }

  let payload;
  try {
    payload = JSON.parse(result.stdout);
  } catch {
    return [];
  }

  const explicitDeviceId = process.env.IOS_DEVICE_UDID?.trim();
  return Object.values(payload.devices ?? {})
    .flat()
    .filter(
      (device) =>
        device.state === "Booted" &&
        device.isAvailable !== false &&
        (!explicitDeviceId || device.udid === explicitDeviceId)
    )
    .filter((device) => {
      const appContainer = run("xcrun", [
        "simctl",
        "get_app_container",
        device.udid,
        iosBundleIdentifier,
        "app",
      ]);
      return appContainer.status === 0;
    });
}

/** 부팅된 시뮬레이터의 기존 test 앱을 종료한 뒤 다시 실행하며 앱 설치는 수행하지 않는다. */
function restartBootedIosSimulatorApps() {
  const errors = [];
  let count = 0;

  for (const simulator of readBootedIosSimulators()) {
    console.log(`[native-sync-web] iOS 시뮬레이터 앱 재시작: ${simulator.name}`);
    run("xcrun", ["simctl", "terminate", simulator.udid, iosBundleIdentifier]);
    const launched = run(
      "xcrun",
      ["simctl", "launch", simulator.udid, iosBundleIdentifier],
      { stdio: "inherit" }
    );

    if (launched.status === 0) {
      count += 1;
    } else {
      errors.push(`${simulator.name} iOS 시뮬레이터 앱 재시작 실패`);
    }
  }

  return { count, errors };
}

function restartIosSimulatorApps() {
  if (!iosBundleIdentifier) {
    return { count: 0, errors: [] };
  }

  return restartBootedIosSimulatorApps();
}

await assertMetroIsRunning();
const { count: restartedCount, errors } = restartIosSimulatorApps();

if (restartedCount === 0) {
  throw new Error(errors[0] || "test 앱이 설치된 부팅 상태의 iOS 시뮬레이터를 찾지 못했습니다.");
}
if (errors.length > 0) {
  throw new Error(errors.join("\n"));
}

console.log(`[native-sync-web] ${restartedCount}개 iOS 시뮬레이터에 최신 Web UI 번들 반영 완료`);
