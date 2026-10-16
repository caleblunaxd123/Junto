// Real loopback API and fictional accounts; the reference fixture never contacts a market API.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const { chromium, webkit } = require('playwright-core');
require('./local-qa.cjs').localQa();
const WEB = `http://127.0.0.1:${Number(process.env.JUNTO_QA_WEB_PORT || 8090)}`;
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3041, {}); let browser;
  try {
    await server.ready;
    async function user(nombre) {
      const u = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: u.id, token: jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    for (const width of [390, 1440]) {
      const owner = await user('Receptor QA'), payer = await user('Pagador QA');
      // The app's "Hoy" is the LOCAL day (UTC is already tomorrow after 7 p.m. in Peru).
      const now = new Date(); const fecha = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const reference = await db.cotizacionCambio.create({ data: { clave: randomUUID(), origen: 'USD', destino: 'COP', fecha: new Date(fecha + 'T00:00:00Z'), tasa: '4000', fuente: 'Referencia ficticia local QA' } });
      async function post(route, who, body) {
        const r = await fetch('http://127.0.0.1:3041/api' + route, { method: 'POST', headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: JSON.stringify(body) });
        assert.ok(r.ok, await r.clone().text()); return r.json();
      }
      const group = await post('/grupos', owner, { nombre: 'Viaje COP QA', pais: 'CO', moneda: 'COP' });
      await post('/grupos/unirse', payer, { link: group.linkInvitacion });
      await post(`/grupos/${group.id}/gastos`, owner, { descripcion: 'Cuenta COP', montoTotal: 1000000, pagadoPor: owner.id, participantes: [owner.id, payer.id].map((usuarioId) => ({ usuarioId })) });
      const errors = [];
      async function contextFor(who) {
        const context = await browser.newContext({ viewport: { width, height: 960 } });
        await context.route('**/*', async (route) => {
          const req = route.request(), url = new URL(req.url());
          if (url.origin === WEB) return route.continue();
          if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
            const cors = { 'Access-Control-Allow-Origin': WEB, 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE' };
            if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
            if (url.pathname === '/api/pagos/tipo-cambio') return route.fulfill({ status: 200, headers: { ...cors, 'Content-Type': 'application/json' }, body: JSON.stringify(reference) });
            const response = await fetch('http://127.0.0.1:3041' + url.pathname + url.search, { method: req.method(), headers: { ...req.headers(), host: '127.0.0.1:3041' }, body: req.postData() || undefined });
            return route.fulfill({ status: response.status, headers: { ...cors, 'Content-Type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
          }
          throw new Error('External browser request blocked: ' + url.origin);
        });
        await context.addInitScript(({ token, id }) => { sessionStorage.setItem('junto.session.accessToken', token); localStorage.setItem(`junto.firstSteps.v2.${id}`, 'seen'); }, who);
        const page = await context.newPage(); page.on('pageerror', (e) => errors.push(e.message)); return { context, page };
      }
      const sender = await contextFor(payer), receiver = await contextFor(owner);
      const page = sender.page;
      await page.goto(`${WEB}/app/grupos/crear`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /^País del plan:/ }).click();
      await page.getByRole('radio', { name: 'Colombia (CO)', exact: true }).click();
      await page.getByRole('button', { name: 'Moneda del grupo: Pesos colombianos, COP', exact: true }).waitFor();
      await page.getByRole('button', { name: /^Moneda del grupo:/ }).click();
      await page.getByRole('radio', { name: 'Dólares estadounidenses (USD)', exact: true }).click();
      await page.getByRole('button', { name: /^Moneda del grupo:/ }).click();
      await page.getByRole('radio', { name: 'Euros (EUR)', exact: true }).click();
      await page.getByRole('button', { name: 'Moneda del grupo: Euros, EUR', exact: true }).waitFor();
      await page.goto(`${WEB}/app/grupos/${group.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Ya pagué', exact: true }).click();
      await page.getByRole('button', { name: 'Más detalles del pago', exact: true }).click();
      // The payment day is picked (Hoy / Ayer / calendar), today by default.
      assert.equal(await page.getByRole('radio', { name: 'Hoy', exact: true }).getAttribute('aria-checked'), 'true');
      await page.getByRole('button', { name: '¿Pagaste en otra moneda?', exact: true }).click();
      await page.getByLabel('Monto pagado en USD', { exact: true }).fill('1');
      await page.getByRole('button', { name: 'Usar esta referencia', exact: true }).click();
      assert.equal(await page.getByLabel('Monto del pago en COP').inputValue(), '4000.00');
      await page.getByLabel('Tipo de cambio de USD a COP', { exact: true }).fill('0');
      assert.equal(await page.getByRole('button', { name: 'Avisar que ya pagué', exact: true }).isDisabled(), true);
      await page.getByRole('button', { name: 'Usar esta referencia', exact: true }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(__dirname, `artifacts/payment-fx-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
      const reportResponse = page.waitForResponse((r) => r.url().endsWith('/api/pagos/reportar') && r.request().method() === 'POST');
      await page.getByRole('button', { name: 'Avisar que ya pagué', exact: true }).click();
      const report = await reportResponse; assert.equal(report.status(), 201, await report.text()); const paid = await report.json();
      assert.equal(paid.monto, 400000); assert.equal(paid.tipoCambio, '4000'); assert.equal(paid.referenciaCambio.id, reference.id);
      await page.getByText('Enviado para aprobación', { exact: true }).waitFor();
      await receiver.page.goto(`${WEB}/app/`, { waitUntil: 'networkidle' });
      await receiver.page.getByText('Pago por confirmar', { exact: true }).first().waitFor();
      await receiver.page.getByRole('button', { name: 'Revisar pago', exact: true }).first().click();
      await receiver.page.getByRole('button', { name: 'Sí, lo recibí', exact: true }).click();
      await receiver.page.getByRole('button', { name: 'Sí, aprobar', exact: true }).click();
      await receiver.page.getByText('Pago confirmado', { exact: true }).first().waitFor();
      const summary = receiver.page.getByTestId('payment-summary');
      assert.equal(await receiver.page.getByTestId('payment-amount').textContent(), 'COP 4,000.00');
      assert.equal(await receiver.page.getByTestId('payment-amount').evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true, 'Amount is fully visible, never ellipsized');
      assert.equal(await summary.evaluate((element) => [...element.querySelectorAll('*')].every((node) => { const a = element.getBoundingClientRect(), b = node.getBoundingClientRect(); return b.left >= a.left - 1 && b.right <= a.right + 1; })), true, 'Payment metadata stays inside its card');
      await receiver.page.screenshot({ path: path.join(__dirname, `artifacts/payment-confirmed-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
      await page.goto(`${WEB}/app/`, { waitUntil: 'networkidle' });
      await page.getByText('Pago confirmado', { exact: true }).first().waitFor();
      assert.deepEqual(errors, []);
      await sender.context.close(); await receiver.context.close();
    }
    console.log('PASS: member reports an external FX payment, reference/source review, invalid rate blocked, recipient notice and confirmation, payer result; 390/1440 layouts and no external requests.');
  } finally { if (browser) await browser.close(); server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
