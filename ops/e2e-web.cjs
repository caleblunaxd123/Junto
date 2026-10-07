// Browser journeys (Expo web, phone-sized) for flows that unit tests cannot see: pending invitation
// after login, expired session, network failure while saving, back navigation and draft reopening.
// Web is a stand-in: it does not replace native keyboard, Google, attachments or Android navigation.
//
// Needs, all local: API on :3005 with a test database, Expo web on :8081 pointing to it, and
// playwright-core + Chromium (not project dependencies). See README «Pruebas de interfaz en web».
//   DATABASE_URL=postgresql://…localhost…/<test db> node ops/e2e-web.cjs
const assert = require("node:assert/strict");
const { chromium } = require("playwright-core");
const { PrismaClient } = require("@prisma/client");
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || "")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const API = process.env.JUNTO_QA_API || "http://localhost:3005/api";
const WEB = process.env.JUNTO_QA_WEB || "http://localhost:8081";
const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const suffix = Date.now();
const password = `Clave${suffix}x`;

async function call(path, token, method = "GET", body) {
  const response = await fetch(API + path, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  return response.status === 204 ? null : response.json();
}
async function account(name) {
  const email = `qa-e2e-${name.toLowerCase()}-${suffix}@example.invalid`;
  await call("/auth/register", null, "POST", { nombre: `${name} QA`, email, password });
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { email, ...(await call("/auth/verify-email", null, "POST", { email, otp: otpCode })) };
}
async function freshPage(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto(`${WEB}/`, { waitUntil: "networkidle", timeout: 180_000 });
  await page.evaluate(() => localStorage.setItem("onboarding_completado", "true"));
  return { context, page };
}
async function login(page, email) {
  await page.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await page.getByPlaceholder("nombre@correo.com").fill(email);
  await page.getByPlaceholder("Tu contraseña").fill(password);
  await page.getByRole("button", { name: /Iniciar sesión/ }).last().click();
}

async function run() {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const ana = await account("Ana");
  const luis = await account("Luis");
  const group = await call("/grupos", ana.accessToken, "POST", { nombre: `Depa E2E ${suffix}`, tipo: "roomies" });
  const { link_invitacion: code } = (await db.$queryRaw`SELECT link_invitacion FROM grupos WHERE id = ${group.id}::uuid`)[0];
  const results = [];
  const scenario = async (name, fn) => {
    try { await fn(); results.push(`ok   ${name}`); }
    catch (error) { results.push(`FAIL ${name}: ${error.message.split("\n")[0]}`); }
  };

  await scenario("G · invitation survives login and ends in the group", async () => {
    const { context, page } = await freshPage(browser);
    await page.goto(`${WEB}/unirse/${code}`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Ya tengo cuenta" }).click();
    await login(page, luis.email);
    await page.getByText(`Depa E2E ${suffix}`).first().waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Unirme al grupo" }).click();
    await page.waitForURL(new RegExp(`/grupos/${group.id}`), { timeout: 15_000 });
    assert.equal(await db.grupoMiembro.count({ where: { grupoId: group.id, usuarioId: luis.usuario.id, activo: true } }), 1);
    await context.close();
  });

  await scenario("G · expired session explains itself on the login screen", async () => {
    const { context, page } = await freshPage(browser);
    await login(page, ana.email);
    await page.getByText("Hola, Ana").waitFor({ timeout: 15_000 });
    // The server ends every session (as after a password reset elsewhere) and the access token is gone.
    await db.refreshToken.updateMany({ where: { usuarioId: ana.usuario.id }, data: { revocado: true } });
    await page.evaluate(() => localStorage.setItem("accessToken", "expired"));
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText(/Tu sesión terminó por seguridad/).waitFor({ timeout: 15_000 });
    await context.close();
  });

  await scenario("G · lost connection while saving: retry keeps one expense", async () => {
    const { context, page } = await freshPage(browser);
    await login(page, ana.email);
    await page.getByText("Hola, Ana").waitFor({ timeout: 15_000 });
    await page.goto(`${WEB}/gastos/agregar?grupoId=${group.id}`, { waitUntil: "networkidle" });
    await page.getByLabel("Monto total en soles").fill("45");
    await page.getByLabel("Descripción del gasto").fill(`Luz E2E ${suffix}`);
    // The request reaches the server, which saves it, but the answer never comes back.
    let dropped = false;
    await page.route("**/api/grupos/*/gastos", async (route) => {
      if (route.request().method() !== "POST" || dropped) return route.continue();
      dropped = true;
      await route.fetch();
      await route.abort("connectionreset");
    });
    await page.getByRole("button", { name: "Guardar gasto" }).click();
    await page.getByText(/No sabemos si se guardó/).waitFor({ timeout: 15_000 });
    await page.getByRole("button", { name: "Guardar gasto" }).click();
    await page.waitForURL(new RegExp(`/grupos/${group.id}`), { timeout: 15_000 });
    assert.equal(await db.gasto.count({ where: { grupoId: group.id, descripcion: `Luz E2E ${suffix}` } }), 1);
    await context.close();
  });

  await scenario("G · a bill draft reopens where it was left, and back keeps the total", async () => {
    const { context, page } = await freshPage(browser);
    await login(page, luis.email);
    await page.getByText("Hola, Luis").waitFor({ timeout: 15_000 });
    await page.goto(`${WEB}/cuentas/rapida`, { waitUntil: "networkidle" });
    await page.getByLabel("Total de la cuenta").fill("240");
    await page.getByRole("button", { name: /Continuar con las personas/ }).click();
    await page.getByText("¿Quiénes participan?").waitFor();
    // Close and reopen the app.
    await page.reload({ waitUntil: "networkidle" });
    await page.getByText("Seguimos donde lo dejaste").waitFor({ timeout: 15_000 });
    await page.getByText("¿Quiénes participan?").waitFor();
    await page.getByText("S/ 240.00").first().waitFor();
    await page.getByRole("button", { name: "Volver" }).first().click();
    await page.getByText("¿Cuánto fue la cuenta?").waitFor();
    assert.equal(await page.getByLabel("Total de la cuenta").inputValue(), "240");
    await context.close();
  });

  await browser.close();
  console.log(results.join("\n"));
  if (results.some((line) => line.startsWith("FAIL"))) process.exitCode = 1;
}
run().finally(() => db.$disconnect()).catch((error) => { console.error(error); process.exit(1); });
