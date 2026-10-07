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
  console.log("Google sign-in QA passed");
}
run().finally(() => prisma.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
