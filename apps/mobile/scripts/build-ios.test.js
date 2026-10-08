/* global __dirname */
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { copyFileSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

/** 실제 빌드 스크립트와 환경 실행기를 사용하되 Xcode·pnpm·버전 확인은 임시 명령으로 대체한다. */
function withFixture(run) {
  const projectRoot = path.resolve(__dirname, "../../..");
  const root = mkdtempSync(path.join(tmpdir(), "mobile-local-ios-"));
  const bin = path.join(root, "bin");
  mkdirSync(bin);
  for (const relativePath of [
    "package.json", "scripts/build-ios.sh", "scripts/terminal-progress.sh",
    "apps/mobile/scripts/build-ios.sh", "apps/mobile/scripts/ios-local-export-options.plist",
    "apps/mobile/scripts/run-with-mobile-env.js", "apps/mobile/scripts/sync-native-config.js",
    "apps/mobile/scripts/sync-xcode-build-env.js",
    "apps/mobile/scripts/sync-ios-project-name.js", "apps/mobile/native.config.json",
  ]) {
    const destination = path.join(root, relativePath);
    mkdirSync(path.dirname(destination), { recursive: true });
    copyFileSync(path.join(projectRoot, relativePath), destination);
  }
  for (const [file, value] of [[".env", "local"], [".env.development", "development"], [".env.production", "production"]]) {
    writeFileSync(path.join(root, "apps/mobile", file), `BUILD_TEST_API=${value}\n`);
  }
  const recorder = path.join(root, "record.js");
  const eventsPath = path.join(root, "events.jsonl");
  writeFileSync(recorder, `
    const { appendFileSync } = require('node:fs');
    const [kind, ...args] = process.argv.slice(2);
    appendFileSync(process.env.BUILD_TEST_EVENTS, JSON.stringify({
      kind, args, variant: process.env.APP_VARIANT, profile: process.env.MOBILE_ENV_PROFILE,
      api: process.env.BUILD_TEST_API, dotenv: process.env.EXPO_NO_DOTENV,
    }) + '\\n');
  `);
  writeFileSync(path.join(root, "scripts/sync-web-to-mobile.mjs"), `
    import { createRequire } from 'node:module';
    process.argv.splice(2, 0, 'web-sync');
    createRequire(import.meta.url)(process.env.BUILD_TEST_RECORDER);
  `);
  const commands = {
    node: `
      if [[ "\${1##*/}" = sync-native-config.js ]]; then
        "$BUILD_TEST_NODE_BINARY" "$BUILD_TEST_RECORDER" confirm "$@"
        exit "\${BUILD_TEST_CONFIRM_STATUS:-0}"
      fi
      exec "$BUILD_TEST_NODE_BINARY" "$@"
    `,
    pnpm: `
      "$BUILD_TEST_NODE_BINARY" "$BUILD_TEST_RECORDER" pnpm "$@"
      if [[ "$*" = *native:sync:* ]]; then
        exit "\${BUILD_TEST_SYNC_STATUS:-0}"
      fi
      exit 0
    `,
    xcodebuild: `
      "$BUILD_TEST_NODE_BINARY" "$BUILD_TEST_RECORDER" xcode "$@"
      if [[ "\${BUILD_TEST_ARCHIVE_STATUS:-0}" != 0 && "$*" = *" archive" ]]; then
        exit "$BUILD_TEST_ARCHIVE_STATUS"
      fi
      while (($#)); do
        case "$1" in
          -archivePath) mkdir -p "$2"; shift ;;
          -exportPath) mkdir -p "$2"; touch "$2/test.ipa"; shift ;;
        esac
        shift
      done
    `,
  };
  for (const [name, body] of Object.entries(commands)) {
    writeFileSync(path.join(bin, name), `#!/bin/bash\nset -euo pipefail\n${body}`, { mode: 0o755 });
  }
  const scripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts;

  /** 루트 package 명령을 실행해 단계 순서와 자식 Xcode 명령에 전달된 환경을 함께 읽는다. */
  function build(variant, extraEnv = {}) {
    const result = spawnSync("/bin/bash", ["-c", scripts[`native:ios:${variant}`]], {
      cwd: root, encoding: "utf8",
      env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, TERM: "dumb",
        APP_VARIANT: variant === "dev" ? "prod" : "dev", MOBILE_ENV_PROFILE: "base",
        BUILD_TEST_NODE_BINARY: process.execPath, BUILD_TEST_RECORDER: recorder,
        BUILD_TEST_EVENTS: eventsPath, ...extraEnv,
      },
    });
    const events = existsSync(eventsPath)
      ? readFileSync(eventsPath, "utf8").trim().split("\n").map((line) => JSON.parse(line))
      : [];
    return { ...result, events };
  }
  try { run({ root, build }); }
  finally { rmSync(root, { recursive: true, force: true }); }
}

for (const [variant, expectedApi, expectedProfile] of [["dev", "development", "development"], ["prod", "production", "prod"]]) {
  test(`${variant} 로컬 빌드는 base 환경을 덮어쓰고 해당 환경으로 Release archive와 IPA를 생성한다`, () => {
    withFixture(({ build }) => {
      const result = build(variant);
      assert.equal(result.status, 0, result.stderr);
      assert.deepEqual(result.events.map((event) => event.kind), ["confirm", "pnpm", "pnpm", "web-sync", "xcode", "xcode"]);
      const [confirm, sync, , , archive, exported] = result.events;
      assert.deepEqual(confirm.args.slice(1), [variant, "--confirm-only"]);
      assert.deepEqual(sync.args.slice(2), [`native:sync:${variant}`, "--", "--yes"]);
      for (const event of [confirm, sync, archive, exported]) assert.equal(event.profile, expectedProfile);
      for (const event of [archive, exported]) {
        assert.equal(event.variant, variant);
        assert.equal(event.api, expectedApi);
        assert.equal(event.dotenv, "1");
      }
      assert.equal(archive.args[archive.args.indexOf("-configuration") + 1], "Release");
      const projectName = variant === "prod" ? "dailo" : "dailoT";
      assert.equal(archive.args[archive.args.indexOf("-scheme") + 1], projectName);
      assert.match(archive.args[archive.args.indexOf("-workspace") + 1], new RegExp(`/ios/${projectName}\\.xcworkspace$`));
      assert.equal(archive.args.at(-1), "archive");
      assert.equal(exported.args[0], "-exportArchive");
      assert.match(archive.args[archive.args.indexOf("-archivePath") + 1], new RegExp(`ios-${variant}-.*\\.xcarchive$`));
      assert.match(result.stdout, new RegExp(`IPA: .*ios-${variant}-.*/test\\.ipa`));
    });
  });
}

test("prod 버전 확인을 취소하면 파일 생성과 후속 빌드를 실행하지 않는다", () => {
  withFixture(({ root, build }) => {
    const result = build("prod", { BUILD_TEST_CONFIRM_STATUS: "1" });
    assert.equal(result.status, 1);
    assert.deepEqual(result.events.map((event) => event.kind), ["confirm"]);
    assert.equal(existsSync(path.join(root, "apps/mobile/dist")), false);
  });
});

test("prod 설정 동기화가 실패하면 웹 빌드와 Xcode 빌드를 중단한다", () => {
  withFixture(({ build }) => {
    const result = build("prod", { BUILD_TEST_SYNC_STATUS: "1" });
    assert.equal(result.status, 1);
    assert.deepEqual(result.events.map((event) => event.kind), ["confirm", "pnpm"]);
  });
});

test("prod archive가 실패하면 IPA 내보내기를 실행하지 않는다", () => {
  withFixture(({ build }) => {
    const result = build("prod", { BUILD_TEST_ARCHIVE_STATUS: "1" });
    assert.equal(result.status, 1);
    assert.equal(result.events.filter((event) => event.kind === "xcode").length, 1);
    assert.doesNotMatch(result.stdout, /iOS 프로덕션 빌드 완료/);
  });
});
