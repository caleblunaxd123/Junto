// Local-only fictional data. Never sends a message or transfers money.
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const origin = require("./local-qa.cjs").localQa();
const db = new PrismaClient();
async function raw(path, token, method = "GET", body, rawBody) {
  const response = await fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: rawBody ?? (body ? JSON.stringify(body) : undefined) });
  return { status: response.status, data: await response.json().catch(() => ({})) };
}
async function request(path, token, method = "GET", body, status = 200) {
  const { status: got, data } = await raw(path, token, method, body);
  assert.equal(got, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function run() {
  const suffix = Date.now();
  const password = `Endurecer${suffix}!`;
  const users = [];
  for (const name of ["Admin", "Segunda"]) {
    const email = `qa-hard-${name.toLowerCase()}-${suffix}@example.invalid`;
    const usuario = await db.usuario.create({ data: { nombre: `${name} QA`, email, emailVerificado: true, passwordHash: await bcrypt.hash(password, 12) } });
    const { accessToken, refreshToken } = await request("/auth/login", null, "POST", { email, password });
    users.push({ id: usuario.id, email, token: accessToken, refreshToken });
  }
  const [admin, second] = users;

  // Malformed input is a client error, never a 500.
  const badJson = await raw("/grupos", admin.token, "POST", undefined, "{ not json");
  assert.equal(badJson.status, 400, "malformed JSON must be 400");
  assert.equal((await raw("/grupos/no-es-uuid", admin.token)).status, 404, "non-UUID group id must be 404");
  assert.equal((await raw("/gastos/no-es-uuid", admin.token)).status, 404, "non-UUID expense id must be 404");

  // Login must answer the same way for unknown and wrong-password accounts.
  const unknown = await raw("/auth/login", null, "POST", { email: `nadie-${suffix}@example.invalid`, password });
  const wrong = await raw("/auth/login", null, "POST", { email: admin.email, password: "OtraClave123!" });
  assert.equal(unknown.status, 401);
  assert.deepEqual(unknown.data, wrong.data);

  // Push tokens: validated, and a device belongs to one account at a time.
  assert.equal((await raw("/auth/push-token", admin.token, "PUT", { expoPushToken: "cualquier-cosa" })).status, 400);
  const token = `ExponentPushToken[qa${suffix}]`;
  await request("/auth/push-token", admin.token, "PUT", { expoPushToken: token });
  await request("/auth/push-token", second.token, "PUT", { expoPushToken: token });
  assert.equal((await db.usuario.findUnique({ where: { id: admin.id } })).expoPushToken, null, "previous owner stops receiving");
  assert.equal((await db.usuario.findUnique({ where: { id: second.id } })).expoPushToken, token);
  await Promise.all([admin, second, admin, second].map(user => request("/auth/push-token", user.token, "PUT", { expoPushToken: token, refreshToken: user.refreshToken })));
  assert.equal(await db.usuario.count({ where: { expoPushToken: token } }), 1, "concurrent registration leaves one device owner");
  await request("/auth/push-token", second.token, "PUT", { expoPushToken: token, refreshToken: second.refreshToken });

  // The only admin leaving hands the group to the longest-standing member.
  const group = await request("/grupos", admin.token, "POST", { nombre: "Grupo endurecido QA", tipo: "amigos" }, 201);
  await request("/grupos/unirse", second.token, "POST", { link: group.linkInvitacion });
  await request(`/grupos/${group.id}/salir`, admin.token, "DELETE");
  const roles = await db.grupoMiembro.findMany({ where: { grupoId: group.id } });
  assert.equal(roles.find((m) => m.usuarioId === second.id).rol, "admin", "remaining member becomes admin");
  assert.equal(roles.find((m) => m.usuarioId === admin.id).activo, false);
  await request(`/grupos/${group.id}`, second.token, "PUT", { nombre: "Renombrado por nueva admin" });

  // Bulk invitations are bounded.
  assert.equal((await raw(`/grupos/${group.id}/miembros-bulk`, second.token, "POST", { celulares: Array.from({ length: 31 }, (_, i) => `9000000${String(i).padStart(2, "0")}`) })).status, 400);

  // Logout can only detach the exact device belonging to that live refresh credential.
  assert.equal((await raw("/auth/logout", null, "POST", { refreshToken: second.refreshToken, expoPushToken: "invalid" })).status, 400);
  await request("/auth/logout", null, "POST", { refreshToken: admin.refreshToken, expoPushToken: token }, 204);
  assert.equal((await db.usuario.findUnique({ where: { id: second.id } })).expoPushToken, token, "old owner cannot detach the new owner");
  await request("/auth/logout", null, "POST", { refreshToken: second.refreshToken, expoPushToken: token }, 204);
  assert.equal((await db.usuario.findUnique({ where: { id: second.id } })).expoPushToken, null);
  assert.equal((await raw("/auth/push-token", second.token, "PUT", { expoPushToken: token, refreshToken: second.refreshToken })).status, 401, "late registration after logout must fail");

  const fresh = await request("/auth/login", null, "POST", { email: second.email, password });
  await request("/auth/push-token", fresh.accessToken, "PUT", { expoPushToken: token, refreshToken: fresh.refreshToken });
  const rotatedDevice = `ExponentPushToken[qa-new-${suffix}]`;
  await request("/auth/push-token", fresh.accessToken, "PUT", { expoPushToken: rotatedDevice, refreshToken: fresh.refreshToken });
  await request("/auth/logout", null, "POST", { refreshToken: fresh.refreshToken, expoPushToken: token }, 204);
  assert.equal((await db.usuario.findUnique({ where: { id: second.id } })).expoPushToken, rotatedDevice, "logout from old device preserves a different registered device");

  const concurrent = await request("/auth/login", null, "POST", { email: second.email, password });
  const [put, out] = await Promise.all([
    raw("/auth/push-token", concurrent.accessToken, "PUT", { expoPushToken: token, refreshToken: concurrent.refreshToken }),
    raw("/auth/logout", null, "POST", { refreshToken: concurrent.refreshToken, expoPushToken: token }),
  ]);
  assert.ok([200, 401].includes(put.status)); assert.equal(out.status, 204);
  assert.notEqual((await db.usuario.findUnique({ where: { id: second.id } })).expoPushToken, token, "racing registration cannot reattach logged-out token");
  // A refresh credential from another account is not proof of this user's device ownership.
  const other = await request("/auth/login", null, "POST", { email: admin.email, password });
  assert.equal((await raw("/auth/push-token", concurrent.accessToken, "PUT", { expoPushToken: token, refreshToken: other.refreshToken })).status, 401);
  await request("/auth/logout", null, "POST", { refreshToken: other.refreshToken }, 204);
  console.log(JSON.stringify({ result: "PASS", checks: "malformed JSON, non-UUID ids, uniform login failure, push validation/ownership, session-bound push, safe logout, registration/logout race, admin succession, bounded bulk invites" }));
}
run().then(() => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
