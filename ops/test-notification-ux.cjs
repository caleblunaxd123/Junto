const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { notificationTarget } = require("../apps/mobile/src/lib/notificationTarget.ts");
const { isAuthEntry } = require("../apps/mobile/src/lib/authEntry.ts");
const id = "12345678-abcd-1234-abcd-123456789012";
test("notification destinations require an exact UUID and open the specific resource", () => {
  assert.equal(notificationTarget({ gastoId: id, grupoId: id }), `/(app)/gastos/${id}`);
  assert.equal(notificationTarget({ pagoId: id, grupoId: id }), `/(app)/pagos/${id}`);
  assert.equal(notificationTarget({ grupoId: id }), `/(app)/grupos/${id}`);
  for (const invalid of ["-".repeat(36), "a".repeat(36), "../../perfil", 123, {}, null]) assert.equal(notificationTarget({ gastoId: invalid }), null);
  assert.equal(notificationTarget(undefined), null);
});
test("protected account endpoints refresh expired tokens, but credential exchanges do not", () => {
  for (const path of ["/auth/me", "/auth/push-token", "/auth/perfil", "/grupos"]) assert.equal(isAuthEntry(path), false, path);
  for (const path of ["/auth/login", "/auth/refresh", "/auth/logout", "/auth/google", "/auth/verify-email"]) assert.equal(isAuthEntry(path), true, path);
  assert.equal(isAuthEntry("/auth/login?next=inicio"), true);
  assert.equal(isAuthEntry(undefined), false);
});

test("push registration and taps stop when the account changes or the listener unmounts", async () => {
  // Exercise lifecycle code without native modules, permissions, credentials or external sends.
  const Module = require("node:module");
  const originalLoad = Module._load;
  const storage = new Map(); const puts = []; const routes = [];
  let current = true; let permissionRequests = 0; let onTap; let initial = null;
  let permissions = async () => ({ status: "granted" });
  const notifications = {
    AndroidImportance: { DEFAULT: 3 },
    setNotificationHandler() {}, setNotificationChannelAsync: async () => {},
    getPermissionsAsync: () => permissions(),
    requestPermissionsAsync: async () => { permissionRequests++; return { status: "granted" }; },
    getExpoPushTokenAsync: async () => ({ data: "ExponentPushToken[fictional-device]" }),
    addNotificationResponseReceivedListener: callback => { onTap = callback; return { remove() { onTap = undefined; } }; },
    getLastNotificationResponseAsync: async () => initial,
  };
  Module._load = function(request, parent, ...rest) {
    if (parent?.filename.endsWith("push.ts")) {
      if (request === "react-native") return { Platform: { OS: "android" } };
      if (request === "expo-constants") return { __esModule: true, default: { expoConfig: { extra: { eas: { projectId: "qa" } } } }, ExecutionEnvironment: { StoreClient: "store" } };
      if (request === "expo-secure-store") return { getItemAsync: async key => storage.get(key) || null, setItemAsync: async (key, value) => storage.set(key, value), deleteItemAsync: async key => storage.delete(key) };
      if (request === "./api") return { api: { put: async (...args) => puts.push(args) } };
      if (request === "expo-notifications") return notifications;
    }
    return originalLoad.call(this, request, parent, ...rest);
  };
  try {
    const push = require("../apps/mobile/src/lib/push.ts");
    const active = () => current;
    await push.registerForPush("qa-user-a", active, new AbortController().signal);
    await push.registerForPush("qa-user-a", active, new AbortController().signal);
    assert.equal(puts.length, 1, "one registration per signed-in owner");
    assert.equal(await push.registeredPushToken("qa-user-b"), undefined);
    push.clearPushRegistration("qa-user-a");
    await push.registerForPush("qa-user-b", active, new AbortController().signal);
    assert.equal(puts.length, 2, "same installation must register for the new owner");
    await push.forgetPushRegistration("qa-user-a");
    assert.equal(await push.registeredPushToken("qa-user-b"), "ExponentPushToken[fictional-device]", "old cleanup preserves the current owner");
    permissions = async () => { current = false; return { status: "denied" }; };
    await push.registerForPush("qa-user-c", active, new AbortController().signal);
    assert.equal(permissionRequests, 0, "no permission request after sign-out");
    assert.equal(puts.length, 2);

    current = true;
    const response = name => ({ notification: { request: { identifier: name, content: { data: { grupoId: id } } } } });
    let resolveInitial;
    initial = new Promise(resolve => { resolveInitial = resolve; });
    const cleanup = push.listenForNotificationTaps({ push: target => routes.push(target) }, active);
    await new Promise(setImmediate);
    cleanup(); resolveInitial(response("qa-cancelled"));
    await new Promise(setImmediate);
    assert.equal(routes.length, 0, "an unmounted initial response cannot navigate");
    initial = response("qa-last");
    const cleanup2 = push.listenForNotificationTaps({ push: target => routes.push(target) }, active);
    await new Promise(setImmediate);
    assert.equal(routes.length, 1);
    onTap(response("qa-last"));
    assert.equal(routes.length, 1, "the same response does not open twice");
    current = false; onTap(response("qa-after-sign-out"));
    assert.equal(routes.length, 1);
    cleanup2();
  } finally { Module._load = originalLoad; }
});
