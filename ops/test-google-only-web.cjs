// Web beta: an account created with Google (no password) accepts an invitation from the browser,
// even if the Google SDK cannot load. Password creation must preserve the invitation.
// Local fictional data only; every request stays in loopback. Needs the web export served on :8090.
// Usage: DATABASE_URL=<local QA db> node ops/test-google-only-web.cjs   (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
const WEB = `http://127.0.0.1:${Number(process.env.JUNTO_QA_WEB_PORT || 8090)}`;
const crypto = require('node:crypto');
const { chromium, webkit } = require('playwright-core');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
async function run() {
  const server = helpers.startApi(3036, {});
  let browser;
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body) {
      const response = await fetch('http://127.0.0.1:3036/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      assert.ok(response.ok, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    // The organizer, with a normal account, creates a group.
    const ownerEmail = `qa-gweb-owner-${suffix}@example.invalid`;
    await call('/auth/register', null, 'POST', { nombre: 'Caleb QA', email: ownerEmail, password: `GoogleWeb${suffix}!` });
    const ownerRow = await db.usuario.findUniqueOrThrow({ where: { email: ownerEmail } });
    const owner = await call('/auth/verify-email', null, 'POST', { email: ownerEmail, otp: ownerRow.otpCode });
    const group = await call('/grupos', owner, 'POST', { nombre: `Cena Google ${suffix}`, integrantes: ['Ana'] });
    // Ana's account exists only through Google: verified, no usable password.
    const anaEmail = `qa-gweb-ana-${suffix}@example.invalid`;
    await db.usuario.create({ data: { nombre: 'Ana Google', email: anaEmail, emailVerificado: true, passwordHash: `!google:${crypto.randomBytes(24).toString('hex')}`, googleId: `qa-${suffix}` } });

    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    const context = await browser.newContext({ viewport: { width: 390, height: 860 } });
    const errors = [];
    await context.route('**/*', async (route) => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin === WEB) return route.continue();
      if (url.origin === 'https://accounts.google.com') return route.abort();
      if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
        const cors = { 'Access-Control-Allow-Origin': WEB, 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const result = await fetch('http://127.0.0.1:3036' + url.pathname + url.search, { method: request.method(), headers: { ...request.headers(), host: '127.0.0.1:3036' }, body: request.postData() || undefined });
        return route.fulfill({ status: result.status, body: Buffer.from(await result.arrayBuffer()), headers: { 'Content-Type': result.headers.get('content-type') || 'application/json', ...cors } });
      }
      throw new Error('External request blocked: ' + url.origin);
    });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));

    // 1. The invitation link, signed out → "Ya tengo cuenta".
    await page.goto(`${WEB}/app/unirse/${group.linkInvitacion}`, { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Ya tengo cuenta', exact: true }).click();
    // 2. Tries a password: no dead end, an explanation and a way forward.
    await page.getByLabel('Correo electrónico').fill(anaEmail);
    await page.getByLabel('Contraseña', { exact: true }).fill('cualquier-clave');
    await page.getByRole('button', { name: 'Iniciar sesión →' }).click();
    await page.getByText('Tu cuenta se creó con Google', { exact: true }).waitFor();
    assert.equal(await page.getByText(/Toca «Continuar con Google»/).count(), 0, 'never points to a button that is not there');
    await page.getByRole('button', { name: 'Crear una contraseña', exact: true }).click();
    // 3. Create a password with an e-mailed code; the e-mail is already filled in.
    await page.getByText('Crea tu contraseña', { exact: true }).waitFor();
    assert.equal(await page.getByLabel('Correo para recuperar cuenta').inputValue(), anaEmail);
    await page.getByRole('button', { name: 'Solicitar código', exact: true }).click();
    await page.getByLabel('Código de recuperación').waitFor();
    const otp = (await db.usuario.findUniqueOrThrow({ where: { email: anaEmail } })).otpCode;
    assert.match(otp, /^\d{6}$/);
    const password = `AnaWeb${suffix}!`;
    await page.getByLabel('Código de recuperación').fill(otp);
    await page.getByLabel('Nueva contraseña', { exact: true }).fill(password);
    await page.getByLabel('Confirmar nueva contraseña').fill(password);
    await page.getByRole('button', { name: 'Actualizar contraseña', exact: true }).click();
    await page.getByText('Contraseña creada', { exact: true }).waitFor();
    // 4. Sign in with it: the invitation was kept, so she lands on it and joins (choosing "Ana").
    await page.getByRole('button', { name: 'Ir a iniciar sesión', exact: true }).click();
    // The web keeps earlier screens mounted in the stack: use the one on top.
    await page.getByLabel('Correo electrónico').last().fill(anaEmail);
    await page.getByLabel('Contraseña', { exact: true }).last().fill(password);
    await page.getByRole('button', { name: 'Iniciar sesión →' }).last().click();
    await page.getByText('¿Eres alguno de ellos?', { exact: true }).last().waitFor({ timeout: 15000 });
    await page.getByRole('radio', { name: 'Soy Ana' }).last().click();
    await page.getByRole('button', { name: 'Unirme como Ana' }).last().click();
    await page.getByLabel('Escribe un mensaje al grupo').last().waitFor({ timeout: 15000 });
    const user = await db.usuario.findUniqueOrThrow({ where: { email: anaEmail } });
    assert.equal(await db.grupoMiembro.count({ where: { grupoId: group.id, usuarioId: user.id, activo: true } }), 1);
    assert.ok(user.googleId, 'Google stays linked: the app keeps signing in with Google');
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: Google-only account on the web is guided to create a password (e-mail prefilled, code by e-mail), keeps the invitation, signs in and joins as the name it was added with; Google stays linked. No external requests.');
  } catch (error) {
    const newline = String.fromCharCode(10);
    console.error(server.log().split(newline).filter((line) => /error/i.test(line)).slice(-8).join(newline));
    throw error;
  } finally { if (browser) await browser.close(); server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
