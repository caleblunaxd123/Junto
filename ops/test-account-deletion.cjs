// LOCAL QA only: deletes one fictional account and checks nobody else's balance changes.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=postgresql://…localhost… node ops/test-account-deletion.cjs
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || "")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const origin = process.env.JUNTO_QA_API || "http://localhost:3005/api";
const suffix = Date.now();
const password = `JuntoQA${suffix}!`;
async function request(path, token, method = "GET", body, status = 200) {
  const response = await fetch(origin + path, {
    method,
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
  return data;
}
async function account(name) {
  const email = `qa-${name.toLowerCase()}-${suffix}@example.invalid`;
  await request("/auth/register", null, "POST", { nombre: `${name} QA`, email, password }, 201);
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { email, ...(await request("/auth/verify-email", null, "POST", { email, otp: otpCode })) };
}
async function run() {
  const [ana, luis] = [await account("Ana"), await account("Luis")];
  const group = await request("/grupos", ana.accessToken, "POST", { nombre: `QA · Depa ${suffix}`, tipo: "roomies" }, 201);
  await request(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: luis.email });
  await request(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", {
    descripcion: "Luz", montoTotal: 12000, pagadoPor: ana.usuario.id, participantes: [{ usuarioId: ana.usuario.id }, { usuarioId: luis.usuario.id }],
  }, 201);
  // Luis reports a partial payment; Ana sees it as an action addressed to her.
  await request("/pagos/reportar", luis.accessToken, "POST", { grupoId: group.id, receptorId: ana.usuario.id, monto: 2000, metodo: "yape" }, 201);
  const activity = await request("/actividad", ana.accessToken);
  assert.ok(activity.some((e) => e.requiereAccion && e.titulo === "Luis dice que te pagó"));
  assert.ok(activity.some((e) => e.titulo === "Agregaste “Luz”"));

  const summary = await request("/auth/me/eliminacion", ana.accessToken);
  assert.deepEqual([summary.grupos, summary.teDeben, summary.pagosPorConfirmar], [1, 6000, 1]);
  await request("/auth/me", ana.accessToken, "DELETE", { password: "incorrecta1" }, 400);
  await request("/auth/me", ana.accessToken, "DELETE", { password }, 204);

  await request("/auth/me", ana.accessToken, "GET", undefined, 401);
  await request("/auth/login", null, "POST", { email: ana.email, password }, 401);
  await request("/auth/refresh", null, "POST", { refreshToken: ana.refreshToken }, 401);
  // Luis keeps the group (now admin), the debt and a cancelled pending payment.
  const view = await request(`/grupos/${group.id}`, luis.accessToken);
  assert.equal(view.rolUsuario, "admin");
  assert.equal(view.miembros.length, 1);
  assert.deepEqual(view.saldos.map((s) => [s.deudorId, s.acreedorNombre, s.monto]), [[luis.usuario.id, "Usuario eliminado", 6000]]);
  const payments = await request("/pagos/historial", luis.accessToken);
  assert.equal(payments[0].estado, "cancelado");
  const deleted = await db.usuario.findUniqueOrThrow({ where: { id: ana.usuario.id } });
  assert.equal(deleted.email, `eliminado-${ana.usuario.id}@junto.invalid`);
  assert.equal(deleted.activo, false);
  // The e-mail can be used again for a brand-new account.
  await request("/auth/register", null, "POST", { nombre: "Ana Nueva QA", email: ana.email, password }, 201);
  console.log("Account deletion QA passed");
}
run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
