// LOCAL QA: double taps and retries never create a second expense.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=<local test db> node ops/test-expense-idempotency.cjs
const assert = require("node:assert/strict");
const { PrismaClient } = require("@prisma/client");
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || "")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const origin = process.env.JUNTO_QA_API || "http://localhost:3005/api";
const suffix = Date.now();
async function call(path, token, method = "GET", body) {
  const response = await fetch(origin + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return { status: response.status, data: response.status === 204 ? null : await response.json() };
}
async function account(name) {
  const email = `qa-idem-${name}-${suffix}@example.invalid`;
  await call("/auth/register", null, "POST", { nombre: `${name} QA`, email, password: `Clave${suffix}x` });
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return (await call("/auth/verify-email", null, "POST", { email, otp: otpCode })).data;
}
async function run() {
  const ana = await account("ana");
  const luis = await account("luis");
  const group = (await call("/grupos", ana.accessToken, "POST", { nombre: `QA idempotencia ${suffix}`, tipo: "amigos" })).data;
  await call(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: luis.usuario.email });
  const body = { descripcion: "Pizza", montoTotal: 6000, pagadoPor: ana.usuario.id, participantes: [{ usuarioId: ana.usuario.id }, { usuarioId: luis.usuario.id }], solicitudId: `gasto_qa_${suffix}` };
  // Double tap: two identical requests at once.
  const [first, second] = await Promise.all([call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", body), call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", body)]);
  assert.deepEqual([first.status, second.status].sort(), [200, 201]);
  assert.equal(first.data.id, second.data.id);
  // Retry after a timeout: same key returns the same expense.
  const retry = await call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", body);
  assert.equal(retry.status, 200);
  assert.equal(retry.data.id, first.data.id);
  assert.equal(await db.gasto.count({ where: { grupoId: group.id } }), 1);
  // The same key with different content is a conflict, not a silent overwrite.
  const changed = await call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", { ...body, montoTotal: 9000 });
  assert.equal(changed.status, 409);
  // Another person's key never collides with yours.
  const other = await call(`/grupos/${group.id}/gastos`, luis.accessToken, "POST", { ...body, pagadoPor: luis.usuario.id });
  assert.equal(other.status, 201);
  // Without a key the old behaviour stays.
  const { solicitudId: _ignored, ...plain } = body;
  assert.equal((await call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", plain)).status, 201);
  assert.equal(await db.gasto.count({ where: { grupoId: group.id } }), 3);
  // Malformed keys are rejected before touching the database.
  assert.equal((await call(`/grupos/${group.id}/gastos`, ana.accessToken, "POST", { ...body, solicitudId: "x; drop" })).status, 400);
  console.log("Expense idempotency QA passed");
}
run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
