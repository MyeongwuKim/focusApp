/* global __dirname */
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

/** 실제 환경 파일 대신 서로 다른 샘플 값을 넣어 명령 실행기의 파일 선택과 자식 프로세스 전달을 확인한다. */
function withFixture(run) {
  const appRoot = mkdtempSync(path.join(tmpdir(), "mobile-build-env-"));
  const scriptsRoot = path.join(appRoot, "scripts");
  mkdirSync(scriptsRoot);
  for (const file of ["sync-native-config.js", "sync-xcode-build-env.js", "run-with-mobile-env.js"]) {
    copyFileSync(path.join(__dirname, file), path.join(scriptsRoot, file));
  }
  const files = {
    ".env": "MOBILE_ENV_TEST_PROBE=base\nMOBILE_ENV_TEST_BASE=shared\n",
    ".env.local": "MOBILE_ENV_TEST_PROBE=base-local\n",
    ".env.test": "MOBILE_ENV_TEST_PROBE=test\n",
    ".env.dev": "MOBILE_ENV_TEST_PROBE=old-dev\n",
    ".env.development": "MOBILE_ENV_TEST_PROBE=development\n",
    ".env.production": "MOBILE_ENV_TEST_PROBE=production\n",
  };
  for (const [name, content] of Object.entries(files)) writeFileSync(path.join(appRoot, name), content);
  try { run(appRoot, path.join(scriptsRoot, "run-with-mobile-env.js")); }
  finally { rmSync(appRoot, { recursive: true, force: true }); }
}

test("dev는 development 값을 Release 환경의 자식 프로세스까지 전달하고 설정 동기화는 실행하지 않는다", () => {
  withFixture((appRoot, runner) => {
    const result = spawnSync(process.execPath, [runner, "dev", process.execPath, "-e", `
      console.log(JSON.stringify({
        selected: process.env.MOBILE_ENV_TEST_PROBE, base: process.env.MOBILE_ENV_TEST_BASE,
        variant: process.env.APP_VARIANT, mode: process.env.NODE_ENV, dotenv: process.env.EXPO_NO_DOTENV,
      }));
    `], {
      cwd: appRoot, encoding: "utf8",
      env: { ...process.env, MOBILE_ENV_TEST_PROBE: "stale-shell", APP_VARIANT: "prod", NODE_ENV: "production" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
    assert.deepEqual(JSON.parse(result.stdout), {
      selected: "development", base: "shared", variant: "dev", mode: "production", dotenv: "1",
    });
  });
});

test("development.local 우선순위와 자식 명령의 실패 종료 코드를 유지한다", () => {
  withFixture((appRoot, runner) => {
    writeFileSync(path.join(appRoot, ".env.development.local"), "MOBILE_ENV_TEST_PROBE=development-local\n");
    const result = spawnSync(process.execPath, [runner, "dev", process.execPath, "-e", `
      if (process.env.MOBILE_ENV_TEST_PROBE !== 'development-local') process.exit(99);
      process.exit(17);
    `], { cwd: appRoot, encoding: "utf8" });
    assert.equal(result.status, 17, result.stderr);
  });
});

test("test와 prod는 기존 환경 파일 선택을 유지한다", () => {
  withFixture((appRoot, runner) => {
    for (const [variant, expected] of [["test", "test"], ["prod", "production"]]) {
      const result = spawnSync(process.execPath, [runner, variant, process.execPath, "-e",
        "console.log(process.env.MOBILE_ENV_TEST_PROBE)"], { cwd: appRoot, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout.trim(), expected);
    }
  });
});

test("local·device의 base 프로필은 dev 식별자로 실행해도 .env만 적용한다", () => {
  withFixture((appRoot, runner) => {
    writeFileSync(path.join(appRoot, ".env.development.local"), "MOBILE_ENV_TEST_PROBE=development-local\n");
    const result = spawnSync(process.execPath, [runner, "dev", process.execPath, "-e", `
      console.log(JSON.stringify({
        selected: process.env.MOBILE_ENV_TEST_PROBE, variant: process.env.APP_VARIANT,
        dotenv: process.env.EXPO_NO_DOTENV,
      }));
    `], {
      cwd: appRoot, encoding: "utf8",
      env: { ...process.env, MOBILE_ENV_PROFILE: "base", MOBILE_ENV_TEST_PROBE: "stale-shell" },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { selected: "base", variant: "dev", dotenv: "1" });
  });
});
