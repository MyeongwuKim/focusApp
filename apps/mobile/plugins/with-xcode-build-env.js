const { withDangerousMod } = require("expo/config-plugins");
const { syncXcodeBuildEnv } = require("../scripts/sync-xcode-build-env");

/** Expo prebuild로 iOS 프로젝트를 다시 만들어도 Xcode의 환경별 번들 실행기를 복원한다. */
module.exports = function withXcodeBuildEnv(config, { variant }) {
  return withDangerousMod(config, ["ios", (nextConfig) => {
    syncXcodeBuildEnv(nextConfig.modRequest.platformProjectRoot, variant);
    return nextConfig;
  }]);
};
