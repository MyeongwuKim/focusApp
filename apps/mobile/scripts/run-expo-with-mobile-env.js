/* global __dirname */
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { loadMobileEnvFiles } = require("./sync-native-config");

/**
 * Xcode의 Expo 번들 명령을 실행하기 전에 선택한 환경 파일을 로드한다.
 * dev 아카이브는 development 파일이 없으면 중단해 로컬 API로 조용히 대체되지 않게 한다.
 * Expo의 자동 dotenv 로딩을 막고 원래 번들 인자와 Release 최적화 설정을 유지한다.
 */
function runExpoWithMobileEnv() {
  const variant = process.env.APP_VARIANT || "dev";
  if (variant === "dev" && process.env.MOBILE_ENV_PROFILE !== "base" &&
      !existsSync(join(__dirname, "..", ".env.development"))) {
    throw new Error("dev iOS bundle requires .env.development");
  }
  loadMobileEnvFiles(variant);
  const cli = require.resolve("@expo/cli", {
    paths: [require.resolve("expo/package.json")],
  });
  const result = spawnSync(process.execPath, [cli, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, APP_VARIANT: variant, APP_PLATFORM: "ios", EXPO_NO_DOTENV: "1" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

try {
  runExpoWithMobileEnv();
} catch (error) {
  console.error(`[mobile-env] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
