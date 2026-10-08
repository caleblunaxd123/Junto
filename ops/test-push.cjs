// No request leaves the computer: Expo responses are mocked, database is explicit local QA only.
const assert = require("node:assert/strict");
require("./local-qa.cjs").localQa();
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { prisma: db } = require("../apps/api/src/lib/prisma.ts");
const originalFetch = global.fetch;
const originalError = console.error;
const captured = [];
const requests = [];
let response = {};
let beforeResponse = async () => {};
global.fetch = async (url, options) => {
  assert.ok(["https://exp.host/--/api/v2/push/send", "https://exp.host/--/api/v2/push/getReceipts"].includes(url));
  requests.push({ url, data: JSON.parse(options.body) });
  await beforeResponse();
  return { ok: true, status: 200, json: async () => response };
};
console.error = (...args) => captured.push(args.join(" "));
const { sendPushNotification, checkPushReceipts } = require("../apps/api/src/lib/firebase.ts");
const suffix = Date.now();
const token = `ExponentPushToken[local-qa-${suffix}]`;
let user;
async function run() {
  user = await db.usuario.create({ data: { nombre: "Push QA", email: `push-${suffix}@example.invalid`, passwordHash: "!local-qa-not-a-login", expoPushToken: token } });
  response = { data: { status: "error", message: "private-token private-amount", details: { error: "DeviceNotRegistered" } } };
  await sendPushNotification(token, "Local test", "Fictional only");
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: user.id } })).expoPushToken, null);
  assert.match(captured.join(" "), /DeviceNotRegistered/);
  assert.doesNotMatch(captured.join(" "), /private-token|private-amount/);

  await db.usuario.update({ where: { id: user.id }, data: { expoPushToken: token } });
  response = { data: { status: "ok", id: `ticket-${suffix}` } };
  await sendPushNotification(token, "Local test", "Fictional only");
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 1);
  const initialRequests = requests.length;
  await checkPushReceipts();
  assert.equal(requests.length, initialRequests, "tickets younger than 15 min must wait");

  const now = new Date();
  await db.reciboPush.update({ where: { ticketId: `ticket-${suffix}` }, data: { fechaCreacion: new Date(now.getTime() - 16 * 60_000) } });
  response = { data: {} };
  await Promise.all([checkPushReceipts(now), checkPushReceipts(now)]);
  assert.equal(requests.length, initialRequests + 1, "a single worker claims each batch across instances");
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 1, "missing receipt is not delivered");

  const next = new Date(now.getTime() + 6 * 60_000);
  const newerToken = `ExponentPushToken[new-local-qa-${suffix}]`;
  await db.usuario.update({ where: { id: user.id }, data: { expoPushToken: newerToken } });
  response = { data: { [`ticket-${suffix}`]: { status: "error", details: { error: "DeviceNotRegistered" } } } };
  await checkPushReceipts(next);
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: user.id } })).expoPushToken, newerToken, "old receipt must not clear new token");
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 0);

  await db.reciboPush.create({ data: { usuarioId: user.id, token: newerToken, ticketId: `expired-${suffix}`, fechaCreacion: new Date(now.getTime() - 25 * 60 * 60_000) } });
  await checkPushReceipts(next);
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 0, "metadata expires after 24 h");

  await db.reciboPush.create({ data: { usuarioId: user.id, token: newerToken, ticketId: `ok-${suffix}`, fechaCreacion: new Date(now.getTime() - 16 * 60_000) } });
  response = { data: { [`ok-${suffix}`]: { status: "ok" } } };
  await checkPushReceipts(next);
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 0, "terminal provider acceptance clears metadata, not proof of device delivery");
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: user.id } })).expoPushToken, newerToken);

  await db.reciboPush.create({ data: { usuarioId: user.id, token: newerToken, ticketId: `invalid-${suffix}`, fechaCreacion: new Date(now.getTime() - 16 * 60_000) } });
  response = { data: { [`invalid-${suffix}`]: { status: "error", details: { error: "DeviceNotRegistered" } } } };
  await checkPushReceipts(next);
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: user.id } })).expoPushToken, null);
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 0);

  // Deletion racing with a provider response must not recreate personal metadata.
  await db.usuario.update({ where: { id: user.id }, data: { expoPushToken: token } });
  beforeResponse = async () => {
    await db.usuario.update({ where: { id: user.id }, data: { activo: false, expoPushToken: null } });
  };
  response = { data: { status: "ok", id: `inactive-${suffix}` } };
  await sendPushNotification(token, "Local test", "Fictional only");
  assert.equal(await db.reciboPush.count({ where: { usuarioId: user.id } }), 0, "metadata is not recreated after account deletion");
  console.log("Push QA passed: rejected tickets, durable receipts, concurrent claims, token rotation and retention (no external sends)");
}
run().finally(async () => {
  global.fetch = originalFetch;
  console.error = originalError;
  if (user) await db.usuario.delete({ where: { id: user.id } });
  await db.$disconnect();
}).catch((error) => { console.error(error); process.exitCode = 1; });
