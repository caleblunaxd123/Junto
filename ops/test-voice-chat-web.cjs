// Fictional local users and mocked microphone events. No voice, email or remote API request.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken'), bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { chromium, webkit } = require('playwright-core');
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const { createServer } = require('./web/server.cjs');
require('./local-qa.cjs').localQa();
const db = new PrismaClient(), WEB = 'http://127.0.0.1:8093', API = 'http://127.0.0.1:3058';
async function run() {
  const api = startApi(3058, {}), web = createServer(); let browser;
  try {
    await api.ready; await new Promise(r => web.listen(8093, '127.0.0.1', r));
    async function person(nombre) {
      const u = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, emailVerificado: true, passwordHash: await bcrypt.hash('FictionalVoiceQA1!', 4) } });
      return { id: u.id, token: jwt.sign({ userId: u.id, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '15m' }) };
    }
    const owner = await person('Caleb QA'), member = await person('Ana');
    async function call(route, who, method = 'GET', body) {
      const r = await fetch(API+'/api'+route, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: body ? JSON.stringify(body) : undefined });
      const data = await r.json(); assert.ok(r.ok, JSON.stringify(data)); return data;
    }
    const group = await call('/grupos', owner, 'POST', { nombre: 'Voz QA', integrantes: ['Ana', 'Luis'] });
    const details = await call(`/grupos/${group.id}`, owner);
    for (const texto of ['Pagué 120 soles con Mario', 'Pagué 120 soles con Ana y Mario', 'Pagué 120 soles', 'Pagué 120 soles entre todos excepto Luis']) {
      const response = await fetch(API+'/api/ia/gastos/interpretar', { method: 'POST', headers: { Authorization: `Bearer ${owner.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ grupoId: group.id, texto }) });
      assert.equal(response.status, 422, 'Unclear names/participants must ask, never select everyone');
    }
    await call('/grupos/unirse', member, 'POST', { link: details.miembros.find(m => m.usuario.nombre === 'Ana').codigoPersonal });
    await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Cuenta de prueba', montoTotal: 15000, pagadoPor: owner.id, participantes: [{ usuarioId: owner.id }, { usuarioId: member.id }] });
    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      let proposals = 0, expenseWrites = 0, paymentWrites = 0;
      let postponeVoucher = false;
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (url.origin === WEB) return route.continue();
        if (url.origin === 'https://accounts.google.com') return route.abort();
        if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
          const cors = { 'Access-Control-Allow-Origin': WEB, 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE' };
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          if (request.method() === 'POST') {
            if (url.pathname.endsWith('/interpretar')) proposals++;
            if (url.pathname.endsWith('/gastos')) expenseWrites++;
            if (url.pathname.endsWith('/reportar')) paymentWrites++;
          }
          const r = await fetch(API+url.pathname+url.search, { method: request.method(), headers: { ...request.headers(), host: '127.0.0.1:3058' }, body: request.postData() || undefined });
          if (url.pathname.endsWith('/comprobantes') && postponeVoucher) await new Promise(resolve => setTimeout(resolve, 1500));
          return route.fulfill({ status: r.status, headers: { ...cors, 'Content-Type': r.headers.get('content-type') || 'application/json' }, body: Buffer.from(await r.arrayBuffer()) });
        }
        throw Error('External request blocked: '+url.origin);
      });
      await context.addInitScript(token => {
        sessionStorage.setItem('junto.session.accessToken', token);
        window.__voiceStarts = 0;
        window.SpeechRecognition = class {
          start() { window.__voiceStarts++; this.onstart?.(); this.onresult?.({ results: [[{ transcript: 'Pagué ciento veinte soles por la cena con Ana y Luis' }]] }); this.onend?.(); }
          stop() { this.onend?.(); } abort() { this.onend?.(); }
        };
      }, owner.token);
      const page = await context.newPage(), errors = []; page.setDefaultTimeout(12000); page.on('pageerror', e => errors.push(e.message));
      await page.goto(WEB+`/app/gastos/agregar?grupoId=${group.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: /Escribir o dictar un gasto/ }).click();
      await page.getByLabel('Describe el gasto en una frase').fill('Mi frase anterior');
      await page.getByRole('button', { name: 'Dictar gasto con voz', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__voiceStarts), 0);
      await page.getByRole('button', { name: 'Empezar dictado', exact: true }).click();
      await page.getByRole('button', { name: 'Usar este texto', exact: true }).click();
      assert.equal(proposals, 0); assert.equal(expenseWrites, 0);
      assert.match(await page.getByLabel('Describe el gasto en una frase').inputValue(), /ciento veinte soles/);
      await page.getByRole('button', { name: 'Completar el formulario', exact: true }).click();
      await page.getByLabel('Monto total en PEN').waitFor();
      await page.waitForFunction(() => document.querySelector('input[aria-label="Monto total en PEN"]')?.value === '120.00');
      assert.equal(proposals, 1); assert.equal(expenseWrites, 0);
      await page.getByRole('button', { name: 'Dictar gasto con voz', exact: true }).click();
      await page.getByLabel('Texto dictado del gasto').fill('No reemplazar');
      await page.getByRole('button', { name: 'Cerrar', exact: true }).last().click();
      assert.match(await page.getByLabel('Describe el gasto en una frase').inputValue(), /ciento veinte soles/);
      await page.screenshot({ path: `ops/artifacts/voice-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`, fullPage: true });
      // Switch to the fictional debtor; paperclip goes to the reviewed receipt form, not a message upload.
      await context.addInitScript(token => sessionStorage.setItem('junto.session.accessToken', token), member.token);
      await page.goto(WEB+`/app/grupos/${group.id}`, { waitUntil: 'networkidle' });
      await page.getByRole('button', { name: 'Adjuntar comprobante de pago', exact: true }).click();
      await page.getByRole('button', { name: 'Elegir captura y revisar pago', exact: true }).click();
      await page.getByText('Tu comprobante aparecerá en el chat', { exact: true }).waitFor();
      assert.equal(paymentWrites, 0);
      const chooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Subir comprobante del pago', exact: true }).click();
      await (await chooser).setFiles(require('node:path').join(__dirname, 'qa-voucher.png'));
      await page.getByText('Esto leímos', { exact: true }).waitFor({ timeout: 25000 });
      await page.getByRole('button', { name: 'Quitar el comprobante', exact: true }).waitFor();
      assert.equal(paymentWrites, 0, 'OCR never reports or confirms a payment');
      await page.screenshot({ path: `ops/artifacts/chat-voucher-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`, fullPage: true });
      await page.getByRole('button', { name: 'Quitar el comprobante', exact: true }).click();
      postponeVoucher = true;
      const slowChooser = page.waitForEvent('filechooser');
      await page.getByRole('button', { name: 'Subir comprobante del pago', exact: true }).click();
      await (await slowChooser).setFiles(require('node:path').join(__dirname, 'qa-voucher.png'));
      await page.getByRole('button', { name: 'Cancelar lectura', exact: true }).click();
      assert.equal(await page.getByRole('button', { name: 'Avisar que ya pagué', exact: true }).isDisabled(), true);
      await page.waitForTimeout(1800);
      assert.equal(await page.getByText('Esto leímos', { exact: true }).count(), 0, 'Cancelled OCR cannot change the form later');
      await page.getByRole('button', { name: 'Reintentar la lectura del comprobante', exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth+1));
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS mocked voice + real local interpreter, explicit review/no automatic saves, draft preservation, chat paperclip and responsive layout Chrome/WebKit 390/1440. Physical speech remains untested.');
  } finally { if (browser) await browser.close(); api.child.kill(); await db.$disconnect(); await new Promise(r => web.close(r)); }
}
run().catch(e => { console.error(e.stack); process.exitCode = 1; });
