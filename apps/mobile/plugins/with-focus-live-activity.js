const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const { IOSConfig } = require("expo/config-plugins");

const SOURCE_ROOT = join(__dirname, "focus-live-activity");

function readSourceFile(fileName) {
  return readFileSync(join(SOURCE_ROOT, fileName), "utf8");
}

module.exports = function withFocusLiveActivity(config) {
  const sourceFiles = ["FocusLiveActivityModule.swift", "FocusLiveActivityModule.m"];

  return sourceFiles.reduce(
    (nextConfig, fileName) =>
      IOSConfig.XcodeProjectFile.withBuildSourceFile(nextConfig, {
        filePath: fileName,
        contents: readSourceFile(fileName),
        overwrite: true,
      }),
    config
  );
};
