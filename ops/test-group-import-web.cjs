// Browser QA with fictional accounts; production-shaped requests are intercepted into loopback.
const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { chromium, webkit } = require('playwright-core');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const { startApi } = require('./test-share-email-api.cjs');
require('./local-qa.cjs').localQa();
const db = new PrismaClient();
async function run() {
  const server = startApi(3037, {}); let browser;
  try {
    await server.ready;
    const user = await db.usuario.create({ data: { nombre: 'Caleb QA', email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
    const token = jwt.sign({ userId: user.id, email: user.email, credentialsTag: credentialsTag(user.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' });
    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } }); const errors = [];
      await context.route('**/*', async (route) => {
        const req = route.request(); const url = new URL(req.url());
        if (url.origin === 'http://127.0.0.1:8090') return route.continue();
        if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
          const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8090', 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          const response = await fetch('http://127.0.0.1:3037' + url.pathname + url.search, { method: req.method(), headers: { ...req.headers(), host: '127.0.0.1:3037' }, body: req.postData() || undefined });
          return route.fulfill({ status: response.status, headers: { ...cors, 'Content-Type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
        }
        throw new Error('External browser request blocked: ' + url.origin);
      });
      await context.addInitScript(({ token, userId, width }) => {
        sessionStorage.setItem('junto.session.accessToken', token);
        localStorage.setItem(`junto.firstSteps.v2.${userId}`, 'seen');
        localStorage.setItem('junto.tryBill.v1', JSON.stringify({ total: 20000, tip: 0, extras: 0, savedAt: Date.now() + (width === 1440 ? -1 : 0), people: ['Caleb', 'Ana', 'Luis', 'Marta', 'Jaime'].map((nombre, i) => ({ nombre, invitado: i === 4 })) }));
      }, { token, userId: user.id, width });
      const page = await context.newPage(); page.on('pageerror', (err) => errors.push(err.message));
      await page.goto('http://127.0.0.1:8090/app/', { waitUntil: 'networkidle' });
      const primary = page.getByRole('button', { name: 'Dividir gastos', exact: true });
      await primary.waitFor();
      const box = await primary.boundingBox();
      assert.ok(box.height >= 116 && box.width >= 300, 'prominent accessible action');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Home fits ' + width);
      await page.screenshot({ path: path.join(__dirname, `artifacts/home-dividir-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
      await primary.click();
      await page.getByLabel('Nombre del grupo').waitFor();
      await page.getByText('Primero, ponle nombre al plan y agrega a tu gente.', { exact: true }).waitFor();
      await page.goto('http://127.0.0.1:8090/app/cuentas/pasar-a-grupo?prueba=1', { waitUntil: 'networkidle' });
      await page.getByText('Tu cálculo, en un grupo', { exact: true }).waitFor();
      await page.getByLabel('Nombre del grupo').fill('Cumpleaños QA ' + width);
      await page.getByRole('radio', { name: 'Caleb', exact: true }).first().click();
      await page.getByRole('radio', { name: 'Caleb QA (Tú)', exact: true }).click();
      await page.getByText('Jaime · no paga', { exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width);
      await page.screenshot({ path: path.join(__dirname, `artifacts/group-import-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
      const response = page.waitForResponse((r) => r.url().endsWith('/api/grupos/desde-reparto') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Crear grupo con este reparto', exact: true }).click();
      assert.equal((await response).status(), 201);
      await page.getByLabel('Escribe un mensaje al grupo').waitFor();
      await page.getByText('Te deben S/ 150.00', { exact: true }).first().waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('junto.tryBill.v1')), null, 'trial removed only after confirmed creation');
      // The admin can record receipt for two people added by name, but not their own payment.
      async function localPost(route, body) {
        const r = await fetch('http://127.0.0.1:3037/api' + route, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        assert.equal(r.status, 201); return r.json();
      }
      const fixture = await localPost('/grupos', { nombre: 'Ana recibe QA ' + width, integrantes: ['Ana', 'Luis'] });
      const names = await db.grupoMiembro.findMany({ where: { grupoId: fixture.id }, include: { usuario: true } });
      const ana = names.find((m) => m.usuario.nombre === 'Ana').usuarioId;
      const luis = names.find((m) => m.usuario.nombre === 'Luis').usuarioId;
      await localPost(`/grupos/${fixture.id}/gastos`, { descripcion: 'Cena QA', montoTotal: 10000, pagadoPor: ana, participantes: [{ usuarioId: luis }] });
      await page.goto(`http://127.0.0.1:8090/app/grupos/${fixture.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Cuentas', exact: true }).click();
      await page.getByRole('button', { name: 'Registrar pago recibido por Ana', exact: true }).click();
      await page.getByText('Luis pagó a Ana', { exact: true }).waitFor();
      const amountInput = page.getByLabel('Monto que recibiste');
      await amountInput.fill('25');
      assert.equal(await amountInput.inputValue(), '25');
      const received = page.waitForResponse((r) => r.url().endsWith('/api/pagos/recibido') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Guardar pago recibido', exact: true }).click();
      const receipt = await received;
      assert.equal(receipt.status(), 201);
      const posted = await receipt.json();
      assert.equal(posted.receptorId, ana);
      assert.equal(posted.monto, 2500, 'the first fast edit must not be overwritten by modal initialization');
      assert.equal((await db.pago.findFirstOrThrow({ where: { grupoId: fixture.id } })).resueltoPor, user.id);
      await page.getByText('Luis pagó a Ana', { exact: true }).waitFor({ state: 'hidden' });
      await page.getByRole('button', { name: 'Cuentas', exact: true }).click();
      const balance = page.getByText('Le deben S/ 75.00', { exact: true });
      try { await balance.waitFor({ state: 'attached' }); await balance.scrollIntoViewIfNeeded(); await balance.waitFor(); }
      catch (error) { await page.screenshot({ path: path.join(__dirname, `artifacts/admin-receipt-failure-${width}.png`), fullPage: true }); console.error((await page.locator('body').innerText()).slice(-5000)); throw error; }
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: prominent Dividir gastos action, trial-to-group, birthday exclusion, admin receipt for name-only people, exact balances, mobile/desktop layout; no external requests.');
  } finally { if (browser) await browser.close(); server.child.kill(); await db.$disconnect(); }
}
run().catch((e) => { console.error(e.stack); process.exitCode = 1; });
