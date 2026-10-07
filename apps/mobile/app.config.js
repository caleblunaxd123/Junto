const { validateReleaseEnvironment, appLinkHost } = require("./release-config");
module.exports = ({ config }) => {
  validateReleaseEnvironment(process.env);
  const host = appLinkHost(process.env);
  const android = { ...config.android };
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
  const extra = { ...config.extra };
  if (process.env.EAS_PROJECT_ID) extra.eas = { ...extra.eas, projectId: process.env.EAS_PROJECT_ID };
  return { ...config, android, extra };
};
