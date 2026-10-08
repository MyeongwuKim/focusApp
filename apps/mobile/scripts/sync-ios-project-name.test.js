const assert = require("node:assert/strict");
const { Buffer } = require("node:buffer");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");
const { syncIosProjectName, syncIosProjectPods } = require("./sync-ios-project-name");

/** 소스·앱 식별자·위젯 타깃과 Xcode 참조가 함께 있는 임시 iOS 프로젝트를 만든다. */
function withFixture(run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "ios-project-name-"));
  const files = {
    "dailoT.xcodeproj/project.pbxproj": 'objectVersion = 70; compatibilityVersion = "Xcode 3.2"; name = dailoT; PRODUCT_NAME = dailoT; INFOPLIST_FILE = dailoT/Info.plist; SWIFT_OBJC_BRIDGING_HEADER = dailoT/dailoT-Bridging-Header.h; CODE_SIGN_ENTITLEMENTS = dailoT/dailoT.entitlements; name = FocusLiveActivityWidget; CURRENT_PROJECT_VERSION = 2; PRODUCT_BUNDLE_IDENTIFIER = com.myeongwu.focushybrid; Pods-dailoT.debug.xcconfig;',
    "dailoT.xcodeproj/xcshareddata/xcschemes/dailoT.xcscheme": '<Scheme BlueprintIdentifier="APP_TARGET_ID" BlueprintName="dailoT" BuildableName="dailoT.app" ReferencedContainer="container:dailoT.xcodeproj"/>',
    "dailoT.xcworkspace/contents.xcworkspacedata": '<Workspace location="group:dailoT.xcodeproj"/>',
    "dailoT/Info.plist": '<plist><string>데일로</string><string>com.myeongwu.focushybrid</string></plist>',
    "dailoT/AppDelegate.swift": 'let moduleName = "main"',
    "dailoT/dailoT.entitlements": '<plist><string>group.com.myeongwu.focushybrid.focus-live-activity</string></plist>',
    "dailoT/dailoT-Bridging-Header.h": '#import "RCTBridgeModule.h"',
    "dailoT/Images.xcassets/icon.png": Buffer.from([0, 255, 128, 22]),
    "Podfile": "target 'dailoT' do\nend\n",
  };
  for (const [relativePath, content] of Object.entries(files)) {
    const file = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
  const projectFiles = (name) => ({ projectName: name, appDirectoryName: name });
  const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
  try { run({ root, files, projectFiles, read }); }
  finally { fs.rmSync(root, { recursive: true, force: true }); }
}

test("prod 전환은 Xcode 경로와 스킴을 함께 옮기고 소스·앱 식별자·위젯·빌드 번호를 유지한다", () => {
  withFixture(({ root, files, projectFiles, read }) => {
    assert.equal(syncIosProjectName(root, projectFiles("dailoT"), "dailo"), true);
    assert.equal(fs.existsSync(path.join(root, "dailoT.xcodeproj")), false);
    assert.match(read("dailo.xcodeproj/project.pbxproj"), /name = dailo; PRODUCT_NAME = dailo;/);
    assert.match(read("dailo.xcodeproj/project.pbxproj"), /name = FocusLiveActivityWidget; CURRENT_PROJECT_VERSION = 2; PRODUCT_BUNDLE_IDENTIFIER = com\.myeongwu\.focushybrid;/);
    assert.match(read("dailo.xcodeproj/xcshareddata/xcschemes/dailo.xcscheme"), /BlueprintIdentifier="APP_TARGET_ID" BlueprintName="dailo"/);
    assert.match(read("dailo.xcworkspace/contents.xcworkspacedata"), /group:dailo\.xcodeproj/);
    assert.equal(read("Podfile"), "target 'dailo' do\nend\n");
    for (const file of ["Info.plist", "AppDelegate.swift", "dailo.entitlements", "dailo-Bridging-Header.h", "Images.xcassets/icon.png"]) {
      const previousFile = `dailoT/${file.replace(/^dailo[.-]/, (match) => match.replace("dailo", "dailoT"))}`;
      assert.deepEqual(fs.readFileSync(path.join(root, "dailo", file)), Buffer.from(files[previousFile]));
    }
  });
});

test("dev와 prod를 반복 전환해도 이름과 참조가 누적되지 않는다", () => {
  withFixture(({ root, projectFiles, read }) => {
    let previousName = "dailoT";
    for (const nextName of ["dailo", "dailoT", "dailo"]) {
      syncIosProjectName(root, projectFiles(previousName), nextName);
      assert.match(read(`${nextName}.xcodeproj/project.pbxproj`), new RegExp(`INFOPLIST_FILE = ${nextName}/Info.plist`));
      assert.match(read(`${nextName}.xcodeproj/xcshareddata/xcschemes/${nextName}.xcscheme`), new RegExp(`BlueprintName="${nextName}"`));
      assert.equal(fs.existsSync(path.join(root, previousName)), false);
      previousName = nextName;
    }
    assert.equal(syncIosProjectName(root, projectFiles("dailo"), "dailo"), false);
  });
});

test("목적지 충돌이나 잘못된 이름은 기존 프로젝트를 변경하지 않는다", () => {
  withFixture(({ root, projectFiles, read }) => {
    const originalProject = read("dailoT.xcodeproj/project.pbxproj");
    fs.mkdirSync(path.join(root, "dailo.xcodeproj"));
    assert.throws(() => syncIosProjectName(root, projectFiles("dailoT"), "dailo"), /destination exists/);
    assert.throws(() => syncIosProjectName(root, projectFiles("dailoT"), "../dailo"), /Invalid iOS project name/);
    assert.equal(read("dailoT.xcodeproj/project.pbxproj"), originalProject);
    assert.equal(read("Podfile"), "target 'dailoT' do\nend\n");
    assert.equal(fs.existsSync(path.join(root, ".native-project-name-pods-pending")), false);
  });
});

test("Pods 재생성이 실패하면 다음 동기화에서 재시도하고 완료 후에는 다시 실행하지 않는다", () => {
  withFixture(({ root, projectFiles, read }) => {
    syncIosProjectName(root, projectFiles("dailoT"), "dailo");
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    fs.writeFileSync(path.join(bin, "pod"), `#!/bin/sh
echo "$APP_VARIANT $APP_PLATFORM $*" >> pod-attempts.txt
if [ ! -f allow-pods ]; then exit 1; fi
mkdir -p 'Pods/Target Support Files/Pods-dailo'
touch 'Pods/Target Support Files/Pods-dailo/Pods-dailo.debug.xcconfig'
`, { mode: 0o755 });
    const previousPath = process.env.PATH;
    process.env.PATH = `${bin}:${previousPath}`;
    try {
      assert.throws(() => syncIosProjectPods(root, "dailo", "prod"), /CocoaPods install failed/);
      assert.match(read("dailo.xcodeproj/project.pbxproj"), /objectVersion = 77; compatibilityVersion = "Xcode 16.0";/);
      assert.equal(fs.existsSync(path.join(root, ".native-project-name-pods-pending")), true);
      fs.writeFileSync(path.join(root, "allow-pods"), "");
      syncIosProjectPods(root, "dailo", "prod");
      syncIosProjectPods(root, "dailo", "prod");
      assert.equal(fs.existsSync(path.join(root, ".native-project-name-pods-pending")), false);
      assert.equal(read("pod-attempts.txt"), "prod ios install --no-repo-update\nprod ios install --no-repo-update\n");
    } finally { process.env.PATH = previousPath; }
  });
});
