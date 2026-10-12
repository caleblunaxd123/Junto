// Local fictional identities only. GIS is stubbed; this does NOT certify a real Google login.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { chromium, webkit } = require('playwright-core');
const path = require('node:path');
require('./local-qa.cjs').localQa();
const { startApi } = require('./test-share-email-api.cjs');
const { signInWithGoogleClaims } = require('../apps/api/dist/services/auth.service');
const { prisma } = require('../apps/api/dist/lib/prisma');
const { createServer } = require('./web/server.cjs');
const sdk = `window.google={accounts:{id:{initialize(c){this.c=c},renderButton(p){const b=document.createElement('button');b.textContent='Continuar con Google';b.onclick=()=>{this.c.callback({credential:'fictional-google-token-not-a-real-credential'});this.c.callback({credential:'fictional-google-token-not-a-real-credential'})};p.appendChild(b)},disableAutoSelect(){}}}};`;
async function run() {
  const server = startApi(3042, {}), webServer = createServer(); let browser;
  try {
    await server.ready; await new Promise(r => webServer.listen(8092, '127.0.0.1', r));
    const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
    browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
    for (const width of [390, 1440]) {
      const context = await browser.newContext({ viewport: { width, height: 960 } });
      const sub = randomUUID(), email = `qa-google-web-${sub}@example.invalid`;
      let failSdk = true, failLogin = true, exchanges = 0;
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.origin === 'http://127.0.0.1:8092') return route.continue();
        if (url.origin === 'https://accounts.google.com' && url.pathname === '/gsi/client') {
          if (failSdk) return route.abort();
          return route.fulfill({ contentType: 'text/javascript', body: sdk });
        }
        if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
          const cors = { 'Access-Control-Allow-Origin': 'http://127.0.0.1:8092', 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE' };
          if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          if (url.pathname === '/api/auth/google') {
            const body = req.postDataJSON(); assert.equal(body.idToken, 'fictional-google-token-not-a-real-credential'); assert.match(body.nonce, /^[a-f0-9]{64}$/); exchanges++;
            if (failLogin) return route.fulfill({ status: 401, headers: cors, json: { error: 'No pudimos confirmar tu cuenta de Google. Intenta de nuevo.' } });
            const data = await signInWithGoogleClaims({ sub, email, name: 'Google Web QA', emailVerified: true });
            return route.fulfill({ status: 200, headers: cors, json: data });
          }
          const response = await fetch('http://127.0.0.1:3042' + url.pathname + url.search, { method: req.method(), headers: { ...req.headers(), host: '127.0.0.1:3042' }, body: req.postData() || undefined });
          return route.fulfill({ status: response.status, headers: { ...cors, 'Content-Type': response.headers.get('content-type') || 'application/json' }, body: Buffer.from(await response.arrayBuffer()) });
        }
        throw Error('External request blocked: ' + url.origin);
      });
      const page = await context.newPage(); const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('http://127.0.0.1:8092/app/login', { waitUntil: 'networkidle' });
      await page.getByText('No pudimos cargar Google. Reintenta o entra con tu correo.', { exact: true }).waitFor();
      await page.getByLabel('Correo electrónico', { exact: true }).waitFor();
      failSdk = false;
      await page.getByRole('button', { name: 'Reintentar Google', exact: true }).click();
      await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
      await page.getByText('No pudimos confirmar tu cuenta de Google. Intenta de nuevo.', { exact: true }).waitFor();
      assert.equal(exchanges, 1, 'Duplicate callbacks must produce one exchange');
      assert.equal(await page.evaluate(() => sessionStorage.getItem('junto.session.accessToken')), null);
      failLogin = false;
      await page.getByRole('button', { name: 'Continuar con Google', exact: true }).click();
      await page.getByRole('button', { name: 'Cerrar guía', exact: true }).click();
      await page.getByText('Hola, Google', { exact: true }).waitFor();
      assert.equal(exchanges, 2);
      assert.ok(await page.evaluate(() => sessionStorage.getItem('junto.session.accessToken')));
      assert.equal(await prisma.usuario.count({ where: { email } }), 1);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      await page.screenshot({ path: path.join(__dirname, `artifacts/google-web-${engine === webkit ? 'webkit' : 'chrome'}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close();
    }
    console.log('PASS Google web stub: SDK error/retry, email fallback, rejected exchange, nonce, duplicate callback gate, successful local session; Chrome/WebKit 390/1440. Real OAuth remains a separate check.');
  } finally { if (browser) await browser.close(); server.child.kill(); await prisma.$disconnect(); await new Promise(r => webServer.close(r)); }
}
run().catch(e => { console.error(e.stack); process.exitCode = 1; });
