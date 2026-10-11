// LOCAL QA: "Continuar con Google" against a real database.
// Google's signature check is covered by google-auth-library; here we feed already-verified claims
// to the same service the endpoint uses, and check the HTTP endpoint rejects forged tokens.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=… JWT_SECRET=<same as the API> node ops/test-google-sign-in.cjs
const assert = require("node:assert/strict");
const origin = require("./local-qa.cjs").localQa();
const { signInWithGoogleClaims } = require("../apps/api/dist/services/auth.service");
const { prisma } = require("../apps/api/dist/lib/prisma");
const suffix = Date.now();
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
async function run() {
  // Forged or garbage tokens never get through the endpoint.
  const forged = await fetch(origin + "/auth/google", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxIn0.firma-falsa" }) });
  assert.ok([401, 503].includes(forged.status), `forged token status ${forged.status}`);

  // 1. New Google user: verified account, no password, can use the app.
  const email = `google-${suffix}@example.invalid`;
  const created = await signInWithGoogleClaims({ sub: `sub-${suffix}`, email, emailVerified: true, name: "Rosa Google QA" });
  assert.equal(created.nuevo, true);
  assert.equal(created.usuario.tienePassword, false);
  assert.equal(created.usuario.conGoogle, true);
  const me = await request("/auth/me", created.accessToken);
  assert.equal(me.nombre, "Rosa Google QA");
  // Same Google identity again: same account, not a duplicate.
  const again = await signInWithGoogleClaims({ sub: `sub-${suffix}`, email, emailVerified: true, name: "Rosa" });
  assert.equal(again.usuario.id, created.usuario.id);
  assert.equal(again.nuevo, false);
  // Password login explains how to get in instead of a generic error.
  const wrong = await request("/auth/login", null, "POST", { email, password: "Cualquiera123" }, 401);
  assert.equal(wrong.code, "USA_GOOGLE");

  // 2. Someone registered this e-mail with a password but never verified it: Google proves who owns
  //    the inbox, the account is linked and the unproven password stops working.
  const victim = `victima-${suffix}@example.invalid`;
  await request("/auth/register", null, "POST", { nombre: "Cuenta Previa QA", email: victim, password: "Atacante2026" }, 201);
  const linked = await signInWithGoogleClaims({ sub: `sub-v-${suffix}`, email: victim, emailVerified: true, name: "Dueña Real" });
  assert.equal(linked.nuevo, false);
  assert.equal(linked.usuario.tienePassword, false);
  await request("/auth/login", null, "POST", { email: victim, password: "Atacante2026" }, 401);

  // 3. A verified password account keeps its password and gains Google.
  const both = `ambos-${suffix}@example.invalid`;
  await request("/auth/register", null, "POST", { nombre: "Ambos QA", email: both, password: "Clave2026x" }, 201);
  const { otpCode } = await prisma.usuario.findUniqueOrThrow({ where: { email: both } });
  await request("/auth/verify-email", null, "POST", { email: both, otp: otpCode });
  const withGoogle = await signInWithGoogleClaims({ sub: `sub-b-${suffix}`, email: both, emailVerified: true });
  assert.equal(withGoogle.usuario.tienePassword, true);
  await request("/auth/login", null, "POST", { email: both, password: "Clave2026x" });
  // A different Google account can never take that e-mail.
  await assert.rejects(signInWithGoogleClaims({ sub: `sub-intruso-${suffix}`, email: both, emailVerified: true }), /otra cuenta de Google/);
  await assert.rejects(signInWithGoogleClaims({ sub: `sub-x-${suffix}`, email: `x-${suffix}@example.invalid`, emailVerified: false }), /no tiene el correo verificado/);

  // 4. Google-only account deletion uses a typed confirmation instead of a password.
  await request("/auth/me", created.accessToken, "DELETE", {}, 400);
  await request("/auth/me", created.accessToken, "DELETE", { confirmacion: "eliminar" }, 204);
  const gone = await prisma.usuario.findUniqueOrThrow({ where: { id: created.usuario.id } });
  assert.equal(gone.googleId, null);
  assert.equal(gone.activo, false);
  // Signing in with that Google account again starts a fresh, empty account.
  const fresh = await signInWithGoogleClaims({ sub: `sub-${suffix}`, email, emailVerified: true, name: "Rosa" });
  assert.notEqual(fresh.usuario.id, created.usuario.id);

  // Simultaneous first logins all obtain the SAME account, rather than three P2002 errors.
  const simultaneousEmail = `google-race-${suffix}@example.invalid`;
  const simultaneous = await Promise.all(Array.from({ length: 4 }, () => signInWithGoogleClaims({
    sub: `sub-race-${suffix}`, email: simultaneousEmail, emailVerified: true, name: "Google Race QA",
  })));
  assert.equal(new Set(simultaneous.map(value => value.usuario.id)).size, 1);
  assert.equal(simultaneous.filter(value => value.nuevo).length, 1);
  assert.equal(await prisma.usuario.count({ where: { email: simultaneousEmail } }), 1);
  for (const session of simultaneous) await request("/auth/me", session.accessToken);

  // Two different Google identities cannot both link an existing password account.
  const contested = `google-contested-${suffix}@example.invalid`;
  await request("/auth/register", null, "POST", { nombre: "Google Link Race QA", email: contested, password: "Clave2026x" }, 201);
  const contenders = [`sub-left-${suffix}`, `sub-right-${suffix}`];
  const linking = await Promise.allSettled(contenders.map(sub => signInWithGoogleClaims({ sub, email: contested, emailVerified: true })));
  assert.equal(linking.filter(value => value.status === "fulfilled").length, 1);
  const rejection = linking.find(value => value.status === "rejected");
  assert.match(rejection.reason.message, /otra cuenta de Google/);
  const stored = await prisma.usuario.findUniqueOrThrow({ where: { email: contested } });
  const winner = linking.findIndex(value => value.status === "fulfilled");
  assert.equal(stored.googleId, contenders[winner]);
  await request("/auth/me", linking[winner].value.accessToken);

  // If verification wins while Google waits on the account row, preserve the
  // now-proven password rather than applying a stale unverified-account plan.
  const waitingEmail = `google-waiting-${suffix}@example.invalid`;
  await request("/auth/register", null, "POST", { nombre: "Google Waiting QA", email: waitingEmail, password: "Clave2026x" }, 201);
  const before = await prisma.usuario.findUniqueOrThrow({ where: { email: waitingEmail } });
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const blocker = prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${before.id}::uuid FOR UPDATE`;
    entered(); await held;
    await tx.usuario.update({ where: { id: before.id }, data: { emailVerificado: true, otpCode: null, otpPurpose: null, otpExpires: null } });
  }, { timeout: 10000 });
  await ready;
  let settled = false;
  const waiting = signInWithGoogleClaims({ sub: `sub-waiting-${suffix}`, email: waitingEmail, emailVerified: true }).finally(() => { settled = true; });
  try {
    await new Promise(resolve => setTimeout(resolve, 150));
    assert.equal(settled, false, "Google must wait for verification/password changes");
  } finally { release(); await blocker; }
  const after = await waiting;
  assert.equal(after.usuario.tienePassword, true);
  assert.equal((await prisma.usuario.findUniqueOrThrow({ where: { id: before.id } })).passwordHash, before.passwordHash);
  await request("/auth/login", null, "POST", { email: waitingEmail, password: "Clave2026x" });

  console.log("Google sign-in QA passed");
}
run().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
