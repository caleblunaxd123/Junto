const test = require("node:test");
const assert = require("node:assert/strict");
const { validateReleaseEnvironment } = require("../apps/mobile/release-config");
const valid = { EXPO_PUBLIC_APP_ENV: "production", EXPO_PUBLIC_API_URL: "https://api.example.org", EXPO_PUBLIC_PRIVACY_URL: "https://example.org/privacy", EXPO_PUBLIC_DELETE_ACCOUNT_URL: "https://example.org/delete", EXPO_PUBLIC_SUPPORT_EMAIL: "support@example.org" };
test("distribution cannot silently use a local API or missing legal/support configuration", () => {
  validateReleaseEnvironment({ EXPO_PUBLIC_APP_ENV: "development" });
  validateReleaseEnvironment(valid);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_API_URL: "http://localhost:3005" }), /HTTPS/);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_API_URL: "https://192.168.1.20" }), /HTTPS/);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_API_URL: "https://secret:password@api.example.org" }), /HTTPS/);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_PRIVACY_URL: "" }), /PRIVACY_URL/);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_SUPPORT_EMAIL: "" }), /SUPPORT_EMAIL/);
});
const { appLinkHost } = require("../apps/mobile/release-config");
const appConfig = require("../apps/mobile/app.config.js");
test("invitation links open the app through verified https App Links", () => {
  assert.equal(appLinkHost({ EXPO_PUBLIC_WEB_URL: "https://junto.pe", EXPO_PUBLIC_API_URL: "https://api.junto.pe" }), "junto.pe");
  assert.equal(appLinkHost({ EXPO_PUBLIC_API_URL: "https://api.junto.pe" }), "api.junto.pe");
  assert.equal(appLinkHost({ EXPO_PUBLIC_API_URL: "http://localhost:3000" }), null);
  assert.throws(() => validateReleaseEnvironment({ ...valid, EXPO_PUBLIC_WEB_URL: "http://junto.pe" }), /HTTPS/);
  const previous = { ...process.env };
  Object.assign(process.env, { EXPO_PUBLIC_APP_ENV: "development", EXPO_PUBLIC_WEB_URL: "https://junto.pe" });
  try {
    const config = appConfig({ config: { android: { package: "com.junto.app" } } });
    assert.deepEqual(config.android.intentFilters[0].data, [{ scheme: "https", host: "junto.pe", pathPrefix: "/unirse" }]);
    assert.equal(config.android.intentFilters[0].autoVerify, true);
  } finally {
    process.env = previous;
  }
});
