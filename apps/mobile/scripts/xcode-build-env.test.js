/* global __dirname */
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { syncXcodeBuildEnv } = require("./sync-xcode-build-env");

/** 환경을 상속하지 않는 Xcode 실행과 동일하게 .xcode.env를 읽고 번들 실행기에 인자를 넘긴다. */
function withFixture(run) {
  const root = mkdtempSync(path.join(tmpdir(), "mobile-xcode-env-"));
  const ios = path.join(root, "ios");
  mkdirSync(path.join(ios, "Pods"), { recursive: true });
  mkdirSync(path.join(root, "scripts"));
  for (const file of ["sync-native-config.js", "sync-xcode-build-env.js", "sync-ios-project-name.js", "run-expo-with-mobile-env.js"]) {
    copyFileSync(path.join(__dirname, file), path.join(root, "scripts", file));
  }
  for (const [file, value] of [[".env", "local"], [".env.development", "development"], [".env.production", "production"]]) {
    writeFileSync(path.join(root, file), `EXPO_PUBLIC_API_ORIGIN=${value}\n`);
  }
  mkdirSync(path.join(root, "node_modules", "expo"), { recursive: true });
  mkdirSync(path.join(root, "node_modules", "@expo", "cli"), { recursive: true });
  writeFileSync(path.join(root, "node_modules", "expo", "package.json"), '{"name":"expo"}');
  writeFileSync(path.join(root, "node_modules", "@expo", "cli", "package.json"), '{"main":"cli.js"}');
  writeFileSync(path.join(root, "node_modules", "@expo", "cli", "cli.js"), `
    console.log(JSON.stringify({
      api: process.env.EXPO_PUBLIC_API_ORIGIN, variant: process.env.APP_VARIANT,
      platform: process.env.APP_PLATFORM, dotenv: process.env.EXPO_NO_DOTENV,
      mode: process.env.NODE_ENV, args: process.argv.slice(2),
    }));
  `);
  writeFileSync(path.join(ios, ".xcode.env"), '# Existing Node configuration\nexport NODE_BINARY="$TEST_NODE_BINARY"\n');
  function bundle(extraEnv = {}) {
    return spawnSync("/bin/bash", ["-c", 'source "$PODS_ROOT/../.xcode.env"; "$NODE_BINARY" "$CLI_PATH" export:embed --dev false'], {
      cwd: root, encoding: "utf8",
      env: { PATH: process.env.PATH, PODS_ROOT: path.join(ios, "Pods"), TEST_NODE_BINARY: process.execPath, NODE_ENV: "production", ...extraEnv },
    });
  }
  try { run({ root, ios, bundle }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

test("Xcode 단독 Release 번들은 development API를 사용하며 인자와 production 최적화를 유지한다", () => {
  withFixture(({ ios, bundle }) => {
    syncXcodeBuildEnv(ios, "dev");
    const result = bundle();
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      api: "development", variant: "dev", platform: "ios", dotenv: "1", mode: "production",
      args: ["export:embed", "--dev", "false"],
    });
    assert.equal(syncXcodeBuildEnv(ios, "dev"), false);
    assert.match(readFileSync(path.join(ios, ".xcode.env"), "utf8"), /# Existing Node configuration/);
  });
});

test("명령에서 지정한 local·device base 프로필은 Xcode 번들 실행에서도 .env를 사용한다", () => {
  withFixture(({ ios, bundle }) => {
    syncXcodeBuildEnv(ios, "dev");
    const result = bundle({ APP_VARIANT: "dev", MOBILE_ENV_PROFILE: "base" });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).api, "local");
  });
});

test("prod로 동기화하면 Xcode 단독 실행도 production 환경을 사용한다", () => {
  withFixture(({ ios, bundle }) => {
    syncXcodeBuildEnv(ios, "dev");
    syncXcodeBuildEnv(ios, "prod");
    const result = bundle();
    assert.equal(result.status, 0, result.stderr);
    assert.equal(JSON.parse(result.stdout).api, "production");
    assert.equal(JSON.parse(result.stdout).variant, "prod");
    assert.equal(readFileSync(path.join(ios, ".xcode.env"), "utf8").match(/# BEGIN mobile build environment/g).length, 1);
  });
});

test("development 파일이 없으면 로컬 API로 대체하지 않고 번들을 중단한다", () => {
  withFixture(({ root, ios, bundle }) => {
    syncXcodeBuildEnv(ios, "dev");
    rmSync(path.join(root, ".env.development"));
    const result = bundle();
    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /requires \.env\.development/);
  });
});
