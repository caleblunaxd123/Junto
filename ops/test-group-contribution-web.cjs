// New group screen against fictional local API data; all network traffic stays in loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const path = require('node:path');
const { chromium, webkit } = require('playwright-core');
require('./local-qa.cjs').localQa();
const helpers = require('./test-share-email-api.cjs');
async function run() {
  const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts/group-contribution-private.json')));
  const server = helpers.startApi(3033, {});
  let browser;
  try {
    await server.ready;
    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    const context = await browser.newContext(); const errors = [];
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.origin === 'http://127.0.0.1:8090') return route.continue();
      if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
        const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8090', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE', 'Access-Control-Allow-Headers': 'authorization,content-type' };
        if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const result = await fetch('http://127.0.0.1:3033' + url.pathname + url.search, { method: request.method(), headers: { ...request.headers(), host: '127.0.0.1:3033' }, body: request.postData() || undefined });
        return route.fulfill({ status: result.status, body: Buffer.from(await result.arrayBuffer()), headers: { 'Content-Type': result.headers.get('content-type') || 'application/json', ...cors } });
      }
      throw new Error('External request blocked: ' + url.origin);
    });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message)); page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript(({ owner }) => {
      sessionStorage.setItem('junto.session.accessToken', owner.accessToken);
      sessionStorage.setItem('junto.session.refreshToken', owner.refreshToken);
    }, fixture);
    for (const width of [360, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`http://127.0.0.1:8090/app/grupos/${fixture.groupId}`, { waitUntil: 'networkidle' });
      // The group opens as a chat: pinned summary, bubbles, quick actions and a message box.
      await page.getByText('Te devolvieron S/ 50.00 de S/ 400.00', { exact: false }).first().waitFor().catch(async (error) => {
        await page.screenshot({ path: path.join(__dirname, 'artifacts/group-chat-web-failure.png') });
        console.error('Page errors:', errors.join(' | '));
        throw error;
      });
      await page.getByText('Te deben S/ 350.00', { exact: true }).first().waitFor();
      assert.ok(await page.getByText(/PAGO · YAPE/).count() >= 1, 'payment bubble');
      assert.ok(await page.getByLabel('Escribe un mensaje al grupo').count() === 1, 'message box');
      await page.getByRole('button', { name: '¿Quién pagó?', exact: true }).click();
      await page.getByText('¿Quién ya pagó?', { exact: true }).waitFor();
      await page.getByText('Falta S/ 50.00', { exact: true }).waitFor();
      await page.getByText('Sin parte', { exact: true }).waitFor();
      if (width === 360) await page.screenshot({ path: path.join(__dirname, 'artifacts/group-chat-web-whopaid-360.png') });
      await page.getByRole('button', { name: 'Cerrar panel' }).click();
      await page.getByText('¿Quién ya pagó?', { exact: true }).waitFor({ state: 'hidden' });
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width);
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `artifacts/group-contribution-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
    }
    await page.goto('http://127.0.0.1:8090/app/', { waitUntil: 'networkidle' });
    await page.getByText(/se unieron a «/).first().waitFor();
    await page.getByText('Grupo de cobranza', { exact: true }).first().waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: group opens as a chat, pinned progress (50 of 400 back), organizer owed 350, payment bubble, message box, who-paid sheet (Ana owes 50, late member without part), grouped join notices and the two group types on Home, five viewport sizes. No external requests.');
  } finally { if (browser) await browser.close(); server.child.kill(); }
}
run().catch(e => { console.error(e.stack); process.exitCode = 1; });
