const { validateReleaseEnvironment, appLinkHost } = require("./release-config");
module.exports = ({ config }) => {
  validateReleaseEnvironment(process.env);
  const host = appLinkHost(process.env);
  const android = { ...config.android };
  android.blockedPermissions = [...new Set([...(android.blockedPermissions || []), "android.permission.RECORD_AUDIO", "android.permission.WRITE_CONTACTS"])];
  // Opens https://<dominio>/unirse/CODE directly in the app (Android App Links).
  if (host)
    android.intentFilters = [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host, pathPrefix: "/unirse" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ];
  // Firebase config for push notifications, provided as an EAS file secret.
  if (process.env.GOOGLE_SERVICES_JSON) android.googleServicesFile = process.env.GOOGLE_SERVICES_JSON;
  // Google Sign-In: Android needs no plugin (only the OAuth clients in Google Cloud); iOS needs its URL scheme.
  const plugins = [...(config.plugins || [])];
  if (!plugins.includes("expo-mail-composer")) plugins.push("expo-mail-composer");
  plugins.push("./plugins/withShareTargets", "./plugins/withQaSigning");
  if (process.env.GOOGLE_IOS_URL_SCHEME)
    plugins.push(["@react-native-google-signin/google-signin", { iosUrlScheme: process.env.GOOGLE_IOS_URL_SCHEME }]);
  const extra = { ...config.extra };
  if (process.env.EAS_PROJECT_ID) extra.eas = { ...extra.eas, projectId: process.env.EAS_PROJECT_ID };
  return { ...config, android, extra, plugins };
};
