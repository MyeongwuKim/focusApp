const { spawnSync } = require("node:child_process");
const { loadMobileEnvFiles } = require("./sync-native-config");

/**
 * 첫 인자로 받은 variant의 모바일 환경값을 로드하고 뒤에 전달된 명령·인자를 실행한다.
 * dev는 .env.development를, MOBILE_ENV_PROFILE=base인 local·device 명령은 .env를 자식 작업까지 전달한다.
 * Expo의 자동 환경 로딩은 막아 Release 번들에서도 선택한 파일을 사용하며 NODE_ENV는 변경하지 않는다.
 */
function runWithMobileEnv() {
  const [, , variant, command, ...args] = process.argv;
  if (!variant || !command) {
    throw new Error("Usage: run-with-mobile-env.js <variant> <command> [...args]");
  }
  loadMobileEnvFiles(variant);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    env: { ...process.env, APP_VARIANT: variant, EXPO_NO_DOTENV: "1" },
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}

try {
  runWithMobileEnv();
} catch (error) {
  console.error(`[mobile-env] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
