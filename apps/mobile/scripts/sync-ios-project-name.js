const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const PODS_PENDING_FILE = ".native-project-name-pods-pending";

/** 이름 변경 대상 폴더의 파일과 하위 폴더를 모으며 심볼릭 링크는 따라가지 않는다. */
function collectEntries(root) {
  const entries = [root];
  for (const child of fs.readdirSync(root, { withFileTypes: true })) {
    const childPath = path.join(root, child.name);
    if (child.isDirectory()) entries.push(...collectEntries(childPath));
    else if (child.isFile()) entries.push(childPath);
  }
  return entries;
}

/**
 * 기존 Expo iOS 프로젝트를 projectName으로 변경한다. 프로젝트·앱 폴더·워크스페이스·스킴과
 * 브리징 헤더·entitlements 경로를 함께 옮기고 Xcode·Podfile 참조를 갱신한다.
 * 앱 표시 이름·식별자·버전과 소스 내용은 유지하며, 목적지 충돌은 파일 변경 전에 중단한다.
 * 이름이 같으면 false를 반환한다. 변경 후에는 Pods 재생성이 끝날 때까지 재시도 표시를 남긴다.
 */
function syncIosProjectName(iosRoot, projectFiles, projectName) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(projectName)) {
    throw new Error(`Invalid iOS project name: ${projectName}`);
  }
  const previousName = projectFiles.projectName;
  if (previousName === projectName) return false;
  if (projectFiles.appDirectoryName !== previousName) {
    throw new Error("iOS project and app directory names must match before renaming.");
  }

  const roots = [previousName, `${previousName}.xcodeproj`, `${previousName}.xcworkspace`]
    .map((name) => path.join(iosRoot, name))
    .filter((root) => fs.existsSync(root));
  const entries = roots.flatMap(collectEntries);
  const moves = entries
    .filter((entry) => path.basename(entry).includes(previousName))
    .map((source) => ({
      source,
      destination: path.join(path.dirname(source), path.basename(source).replaceAll(previousName, projectName)),
    }))
    .sort((a, b) => b.source.split(path.sep).length - a.source.split(path.sep).length);

  for (const { destination } of moves) {
    if (fs.existsSync(destination)) {
      throw new Error(`Cannot rename iOS project: destination exists (${destination}).`);
    }
  }

  const referenceFiles = entries.filter((entry) =>
    fs.statSync(entry).isFile() &&
    (/\.(pbxproj|xcscheme|xcworkspacedata)$/.test(entry) || path.basename(entry) === "xcschememanagement.plist")
  );
  const podfile = path.join(iosRoot, "Podfile");
  if (fs.existsSync(podfile)) referenceFiles.push(podfile);
  for (const file of referenceFiles) {
    const content = fs.readFileSync(file, "utf8");
    if (content.startsWith("bplist")) continue;
    const nextContent = content.replaceAll(previousName, projectName);
    if (nextContent !== content) fs.writeFileSync(file, nextContent);
  }
  for (const { source, destination } of moves) fs.renameSync(source, destination);
  fs.writeFileSync(path.join(iosRoot, PODS_PENDING_FILE), projectName);
  return true;
}

/**
 * 프로젝트 이름 변경으로 달라진 CocoaPods 타깃과 지원 파일을 variant 환경에서 재생성한다.
 * 완료 표시가 남아 있거나 타깃 설정 파일이 없을 때만 실행하며, 실패 시 표시를 유지해 다음 동기화에서 재시도한다.
 * 기존 objectVersion 70은 CocoaPods가 지원하는 Xcode 16 형식(77)으로 정리하고 동기화 폴더·타깃은 유지한다.
 */
function syncIosProjectPods(iosRoot, projectName, variant) {
  const pendingFile = path.join(iosRoot, PODS_PENDING_FILE);
  if (!fs.existsSync(path.join(iosRoot, "Podfile"))) return;
  const targetConfig = path.join(iosRoot, "Pods", "Target Support Files", `Pods-${projectName}`, `Pods-${projectName}.debug.xcconfig`);
  if (!fs.existsSync(pendingFile) && fs.existsSync(targetConfig)) return;

  // Xcodeproj 1.27은 objectVersion 70의 호환성 이름을 제공하지 않아 Pods 생성에 실패한다.
  const projectPath = path.join(iosRoot, `${projectName}.xcodeproj`, "project.pbxproj");
  const projectContent = fs.readFileSync(projectPath, "utf8");
  if (/\bobjectVersion = 70;/.test(projectContent)) {
    fs.writeFileSync(projectPath, projectContent
      .replace(/\bobjectVersion = 70;/, "objectVersion = 77;")
      .replace(/\bcompatibilityVersion = "[^"]+";/, 'compatibilityVersion = "Xcode 16.0";'));
  }

  console.log(`[native-sync] Regenerating CocoaPods for ${projectName}.`);
  const result = spawnSync("pod", ["install", "--no-repo-update"], {
    cwd: iosRoot, stdio: "inherit",
    env: { ...process.env, APP_VARIANT: variant, APP_PLATFORM: "ios", EXPO_NO_DOTENV: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`CocoaPods install failed for ${projectName}.`);
  fs.rmSync(pendingFile, { force: true });
}

module.exports = { syncIosProjectName, syncIosProjectPods };
