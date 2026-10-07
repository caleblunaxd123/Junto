// Local-only fictional data. Never sends a message or transfers money.
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
if (!process.env.DATABASE_URL?.includes("localhost:5433/junto_db")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const origin = "http://localhost:3005/api";
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
    const { accessToken } = await request("/auth/login", null, "POST", { email, password });
    users.push({ id: usuario.id, email, token: accessToken });
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
  console.log(JSON.stringify({ result: "PASS", checks: "malformed JSON, non-UUID ids, uniform login failure, push token validation and ownership, admin succession, bounded bulk invites" }));
}
run().then(() => db.$disconnect()).catch(async (error) => { console.error(error); await db.$disconnect(); process.exit(1); });
