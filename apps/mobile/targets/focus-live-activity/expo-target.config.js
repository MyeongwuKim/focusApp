/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: "widget",
  name: "FocusLiveActivityWidget",
  displayName: "데일로 현황",
  deploymentTarget: "16.1",
  bundleIdentifier: ".FocusLiveActivityWidget",
  entitlements: {
    "com.apple.security.application-groups":
      config.ios?.entitlements?.["com.apple.security.application-groups"] ?? [],
  },
});
