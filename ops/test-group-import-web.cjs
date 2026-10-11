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
          const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8090', 'Access-Control-Allow-Headers': 'authorization,content-type', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE' };
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
      assert.deepEqual(errors, []);
      await context.close();
    }
    console.log('PASS: trial-to-group screen, explicit identity/payer, birthday exclusion, exact balance, mobile and desktop layout; no external requests.');
  } finally { if (browser) await browser.close(); server.child.kill(); await db.$disconnect(); }
}
run().catch((e) => { console.error(e.stack); process.exitCode = 1; });
