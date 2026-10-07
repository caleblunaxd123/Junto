const { withDangerousMod } = require("expo/config-plugins");
const fs = require("node:fs/promises");
const path = require("node:path");

// Only a local development certificate. Never replaces EAS/Play production signing.
module.exports = config => {
  const keystore = process.env.JUNTO_QA_KEYSTORE_PATH;
  if (!keystore) return config;
  if (process.env.EXPO_PUBLIC_APP_ENV && process.env.EXPO_PUBLIC_APP_ENV !== "development")
    throw new Error("JUNTO_QA_KEYSTORE_PATH solo se permite en desarrollo local");
  return withDangerousMod(config, ["android", async mod => {
    await fs.copyFile(path.resolve(keystore), path.join(mod.modRequest.platformProjectRoot, "app", "debug.keystore"));
    return mod;
  }]);
};
