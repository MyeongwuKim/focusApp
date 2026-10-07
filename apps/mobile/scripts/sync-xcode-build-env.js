const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const START = "# BEGIN mobile build environment";
const END = "# END mobile build environment";

/**
 * Xcode 단독 실행에서도 선택한 variant로 번들링하도록 .xcode.env에 실행기 경로를 기록한다.
 * 환경값 자체는 저장하지 않으며, 명령으로 전달된 local·device의 base 프로필은 유지한다.
 * 기존 Node 설정과 사용자 설정은 보존하고 이 함수가 관리하는 블록만 교체한다.
 */
function syncXcodeBuildEnv(iosRoot, variant) {
  if (!["dev", "test", "prod", "production"].includes(variant)) {
    throw new Error(`Unsupported Xcode environment variant: ${variant}`);
  }
  const filePath = join(iosRoot, ".xcode.env");
  const previous = existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
  const start = previous.indexOf(START);
  const end = previous.indexOf(END);
  if ((start >= 0) !== (end >= 0) || (start >= 0 && end < start)) {
    throw new Error("Invalid mobile build environment block in .xcode.env");
  }
  const profile = variant === "dev" ? "development" : variant;
  const block = [
    START,
    `export APP_VARIANT="\${APP_VARIANT:-${variant}}"`,
    `export MOBILE_ENV_PROFILE="\${MOBILE_ENV_PROFILE:-${profile}}"`,
    "export APP_PLATFORM=ios",
    'export CLI_PATH="$PODS_ROOT/../../scripts/run-expo-with-mobile-env.js"',
    END,
  ].join("\n");
  const next = start >= 0
    ? previous.slice(0, start) + block + previous.slice(end + END.length)
    : `${previous.trimEnd()}\n\n${block}\n`;
  if (next === previous) return false;
  writeFileSync(filePath, next);
  return true;
}

module.exports = { syncXcodeBuildEnv };
