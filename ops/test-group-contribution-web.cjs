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
    const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(({ owner }) => {
      sessionStorage.setItem('junto.session.accessToken', owner.accessToken);
      sessionStorage.setItem('junto.session.refreshToken', owner.refreshToken);
    }, fixture);
    for (const width of [360, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width, height: 960 });
      await page.goto(`http://127.0.0.1:8090/app/grupos/${fixture.groupId}`, { waitUntil: 'networkidle' });
      await page.getByText('¿Cuánto paga cada integrante?', { exact: true }).waitFor();
      assert.equal(await page.getByRole('tab', { name: /Reparto/ }).getAttribute('aria-selected'), 'true', 'Reparto is the selected tab');
      assert.ok(await page.getByText('S/ 500.00', { exact: true }).count() >= 1);
      await page.getByText('Te falta recuperar S/ 350.00', { exact: true }).waitFor();
      await page.getByText('Devolvió S/ 50.00 · pagos confirmados.', { exact: true }).waitFor();
      await page.getByText('Aún sin parte asignada', { exact: true }).waitFor();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No overflow at ' + width);
      if ([390, 1440].includes(width)) await page.screenshot({ path: path.join(__dirname, `artifacts/group-contribution-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
    }
    await page.goto('http://127.0.0.1:8090/app/', { waitUntil: 'networkidle' });
    await page.getByText('Novedades de tus grupos', { exact: true }).waitFor();
    assert.equal(errors.length, 0, errors.join('\n'));
    console.log('PASS: group defaults to reparto, total 500 visible, organizer recovers 350 after partial payment, confirmed 50 shown, late member unassigned, durable join notices visible, five viewport sizes. No external requests.');
  } finally { if (browser) await browser.close(); server.child.kill(); }
}
run().catch(e => { console.error(e.stack); process.exitCode = 1; });
