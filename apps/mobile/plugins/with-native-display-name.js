const {
  AndroidConfig,
  withInfoPlist,
  withStringsXml,
} = require("expo/config-plugins");

module.exports = function withNativeDisplayName(config, options = {}) {
  const displayName =
    typeof options.displayName === "string" ? options.displayName.trim() : "";
  if (!displayName) {
    throw new Error("with-native-display-name requires a displayName option.");
  }

  config = withInfoPlist(config, (nextConfig) => {
    nextConfig.modResults.CFBundleDisplayName = displayName;
    nextConfig.modResults.CFBundleName = displayName;
    return nextConfig;
  });

  return withStringsXml(config, (nextConfig) => {
    nextConfig.modResults = AndroidConfig.Strings.setStringItem(
      [
        {
          $: { name: "app_name" },
          _: displayName,
        },
      ],
      nextConfig.modResults
    );
    return nextConfig;
  });
};
