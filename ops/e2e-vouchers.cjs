// Browser journey (Expo web, phone-sized) for payment vouchers: a member uploads a Yape screenshot,
// JUNTO reads it, an admin who is not involved reviews and approves it, the receiver sees who
// approved and can say it never arrived, and everyone comments. Data and voucher are fictitious.
//
// Needs, all local: API on :3005 with a test database, Expo web on :8081 pointing to it,
// playwright-core + Chromium and python3 with Pillow (see README «Pruebas de interfaz en web»).
//   DATABASE_URL=postgresql://…localhost…/<test db> node ops/e2e-vouchers.cjs
// QA_SCREENSHOTS=<dir> also saves one screenshot per step.
const assert = require("node:assert/strict");
const path = require("node:path");
const os = require("node:os");
const { execFileSync } = require("node:child_process");
const { chromium } = require("playwright-core");
const { PrismaClient } = require("@prisma/client");
if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL || "")) throw new Error("Local JUNTO database required");
const db = new PrismaClient();
const API = process.env.JUNTO_QA_API || "http://localhost:3005/api";
const WEB = process.env.JUNTO_QA_WEB || "http://localhost:8081";
const CHROMIUM = process.env.CHROMIUM_PATH || "/opt/pw-browsers/chromium";
const OUT = process.env.QA_SCREENSHOTS;
const suffix = Date.now();
const password = `Clave${suffix}x`;
// A fresh operation number per run: the same screenshot can never back two active payments.
const operation = String(suffix).slice(-8);
const voucherPath = path.join(os.tmpdir(), `junto-voucher-${suffix}.png`);
execFileSync("python3", [path.join(__dirname, "create-voucher-fixture.py"), "--operacion", operation, "--codigo", "7 1 6", "--hora", "11:40 a. m.", "--salida", voucherPath]);
async function call(p, token, method = "GET", body) {
  const r = await fetch(API + p, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = r.status === 204 ? null : await r.json();
  if (r.status >= 400) throw new Error(`${method} ${p} ${r.status} ${JSON.stringify(data)}`);
  return data;
}
async function account(first, last) {
  const email = `qa-web-${first.toLowerCase()}-${suffix}@example.invalid`;
  await call("/auth/register", null, "POST", { nombre: `${first} ${last}`, email, password });
  const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { email, ...(await call("/auth/verify-email", null, "POST", { email, otp: otpCode })) };
}
async function page(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const p = await context.newPage();
  await p.goto(`${WEB}/`, { waitUntil: "networkidle", timeout: 180000 });
  await p.evaluate(() => localStorage.setItem("onboarding_completado", "true"));
  return { context, p };
}
async function login(p, email, first) {
  await p.goto(`${WEB}/login`, { waitUntil: "networkidle" });
  await p.getByPlaceholder("nombre@correo.com").fill(email);
  await p.getByPlaceholder("Tu contraseña").fill(password);
  await p.getByRole("button", { name: /Iniciar sesión/ }).last().click();
  await p.getByText(`Hola, ${first}`).waitFor({ timeout: 20000 });
}
const shot = (p, name) => (OUT ? p.screenshot({ path: path.join(OUT, `${name}.png`) }) : Promise.resolve());
(async () => {
  const browser = await chromium.launch({ executablePath: CHROMIUM, args: ["--no-sandbox"] });
  const ana = await account("Ana", "Admin");
  const luis = await account("Luis", "Paredes");
  const marta = await account("Marta", "Ríos");
  await db.usuario.update({ where: { id: marta.usuario.id }, data: { celular: "987654321" } });
  const group = await call("/grupos", ana.accessToken, "POST", { nombre: "Viaje a Paracas", tipo: "viaje", aprobacionPagos: "administrador" });
  for (const person of [luis, marta]) await call(`/grupos/${group.id}/invitar`, ana.accessToken, "POST", { identificador: person.email });
  const expense = await call(`/grupos/${group.id}/gastos`, marta.accessToken, "POST", { descripcion: "Pollada en la playa", montoTotal: 5000, pagadoPor: marta.usuario.id, participantes: [luis, marta].map((x) => ({ usuarioId: x.usuario.id })) });
  await call("/comentarios", marta.accessToken, "POST", { gastoId: expense.id, texto: "Incluye las gaseosas 🙂" });

  // 1. Luis: from the group, "Subir comprobante".
  let { context, p } = await page(browser);
  await login(p, luis.email, "Luis");
  await p.goto(`${WEB}/grupos/${group.id}`, { waitUntil: "networkidle" });
  await p.getByRole("button", { name: "Subir comprobante" }).waitFor();
  await shot(p, "01-grupo-subir-comprobante");
  const chooser = p.waitForEvent("filechooser", { timeout: 15000 }).catch(() => null);
  await p.getByRole("button", { name: "Subir comprobante" }).click();
  let fc = await chooser;
  if (!fc) {
    const again = p.waitForEvent("filechooser");
    await p.getByRole("button", { name: "Subir la captura de tu Yape o Plin" }).click();
    fc = await again;
  }
  await fc.setFiles(voucherPath);
  await p.getByText("Esto leímos").waitFor({ timeout: 30000 });
  await p.getByText(operation).waitFor();
  assert.equal(await p.getByLabel("Monto del pago en soles").inputValue(), "25.00");
  await shot(p, "02-comprobante-leido");
  await p.getByRole("button", { name: "Enviar para aprobación" }).click();
  await p.getByText("Enviado para aprobación").waitFor({ timeout: 15000 });
  await shot(p, "03-enviado-para-aprobacion");
  await context.close();
  const pago = await db.pago.findFirstOrThrow({ where: { grupoId: group.id, pagadorId: luis.usuario.id } });

  // 2. Ana (admin, not involved): reviews and approves.
  ({ context, p } = await page(browser));
  await login(p, ana.email, "Ana");
  await p.getByText(/registró un pago de S\/ 25\.00 a Marta con comprobante/).waitFor({ timeout: 15000 });
  await shot(p, "04-inicio-admin-revisar");
  await p.getByRole("button", { name: "Revisar comprobante" }).first().click();
  await p.getByText("LEÍDO DEL COMPROBANTE", { exact: false }).waitFor({ timeout: 15000 });
  await p.getByRole("imagebutton", { name: "Ver el comprobante en grande" }).waitFor({ timeout: 15000 }).catch(() => null);
  await shot(p, "05-detalle-pago-admin");
  await p.getByRole("button", { name: "Aprobar", exact: true }).click();
  await p.getByRole("button", { name: "Sí, aprobar" }).click();
  await p.getByText("Lo aprobaste").waitFor({ timeout: 15000 });
  await shot(p, "06a-aprobado-por-admin");
  await p.getByLabel("Escribe un comentario").fill("Revisé la captura: coincide con lo que debías 👍");
  await p.getByRole("button", { name: "Enviar comentario" }).click();
  await p.getByText("Revisé la captura: coincide").waitFor({ timeout: 15000 });
  await shot(p, "06-aprobado-por-admin-con-comentario");
  await context.close();

  // 3. Marta (receiver): sees who approved, can say it never arrived; comments on the expense.
  ({ context, p } = await page(browser));
  await login(p, marta.email, "Marta");
  await p.goto(`${WEB}/pagos/${pago.id}`, { waitUntil: "networkidle" });
  await p.getByText("Aprobado por Ana").waitFor({ timeout: 15000 });
  await p.getByRole("button", { name: "No me llegó este dinero" }).waitFor();
  await shot(p, "07-receptor-ve-aprobacion");
  await p.goto(`${WEB}/gastos/${expense.id}`, { waitUntil: "networkidle" });
  await p.getByText("Incluye las gaseosas").waitFor({ timeout: 15000 });
  await p.getByLabel("Escribe un comentario").fill("Luis ya pagó su parte, gracias");
  await p.getByRole("button", { name: "Enviar comentario" }).click();
  await p.getByText("Luis ya pagó su parte").waitFor({ timeout: 15000 });
  await p.getByText("Comentarios (2)").scrollIntoViewIfNeeded();
  await shot(p, "08-comentarios-en-gasto");
  await p.goto(`${WEB}/grupos/${group.id}`, { waitUntil: "networkidle" });
  await p.getByText("2 comentarios").waitFor({ timeout: 15000 });
  await shot(p, "09-grupo-contador-comentarios");
  await context.close();

  // 4. Settings: create (switch on by default) and edit.
  ({ context, p } = await page(browser));
  await login(p, ana.email, "Ana");
  await p.goto(`${WEB}/grupos/crear`, { waitUntil: "networkidle" });
  await p.getByText("Yo también apruebo los pagos").waitFor();
  await shot(p, "10-crear-grupo-aprobacion");
  await p.goto(`${WEB}/grupos/editar?grupoId=${group.id}`, { waitUntil: "networkidle" });
  await p.getByText("¿Quién aprueba los pagos?").scrollIntoViewIfNeeded();
  await shot(p, "11-editar-quien-aprueba");
  await p.goto(`${WEB}/gastos/${expense.id}`, { waitUntil: "networkidle" });
  await p.getByText("Comentarios (2)").waitFor({ timeout: 15000 });
  await shot(p, "13-gasto-comentarios-arriba");
  await context.close();

  const settled = await db.pago.findUniqueOrThrow({ where: { id: pago.id } });
  assert.equal(settled.estado, "exitoso");
  assert.equal(settled.resueltoPor, ana.usuario.id);
  console.log("ok   vouchers: upload and read, admin approval, receiver view, comments, settings");
  await browser.close();
})().catch((e) => { console.error("FAIL vouchers:", e.message.split("\n")[0]); process.exitCode = 1; }).finally(() => db.$disconnect().then(() => process.exit()));
