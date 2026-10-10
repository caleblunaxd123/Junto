// Existing, explicitly authorized fictional QA account only. No email or new financial record.
const { chromium, webkit } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
if (process.env.JUNTO_AUTHORIZED_GMAIL_QA !== 'true') throw new Error('Explicit QA switch required');
const state = JSON.parse(fs.readFileSync(path.join(__dirname, 'artifacts', 'production-beta-private.json'), 'utf8'));
assert.equal(state.email, 'calebluna41+junto-beta@gmail.com');
const HOST = 'https://junto.lunalav.pe';
async function run() {
  const engine = process.env.JUNTO_QA_WEBKIT === 'true' ? webkit : chromium;
  const browser = await engine.launch(engine === chromium ? { executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true } : { headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(HOST + '/app/onboarding', { waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Crear mi cuenta gratis', exact: true }).waitFor();
    await page.screenshot({ path: path.join(__dirname, 'artifacts', `production-responsive-${engine === chromium ? 'chrome' : 'webkit'}-onboarding.png`) });
    await page.goto(HOST + '/app/login', { waitUntil: 'networkidle' });
    const email = page.getByRole('textbox', { name: 'Correo electrónico', exact: true });
    assert.ok((await email.boundingBox()).width < 500);
    await email.fill(state.email);
    await page.getByPlaceholder('Tu contraseña').fill(state.password);
    await page.getByPlaceholder('Tu contraseña').press('Enter');
    await page.waitForURL(url => !url.pathname.includes('/login'));
    await page.getByRole('button', { name: /Prueba ficticia · JUNTO Beta/ }).waitFor();
    for (const width of [360, 390, 768, 1024, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 }); await page.waitForTimeout(350);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
      assert.equal(await page.getByLabel('Navegación principal', { exact: true }).isVisible(), width >= 1024);
      assert.ok(await page.evaluate(() => sessionStorage.getItem('junto.session.accessToken')));
      await page.getByRole('button', { name: /Prueba ficticia · JUNTO Beta/ }).waitFor();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.getByRole('button', { name: /Prueba ficticia · JUNTO Beta/ }).click();
    await page.getByRole('button', { name: 'Opciones del grupo', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Invitar a mi grupo', exact: true }).click();
    await page.getByLabel('Correo o celular para invitar').fill(state.email);
    await page.getByRole('button', { name: 'Preparar', exact: true }).click();
    const recipient = page.getByPlaceholder('nombre@correo.com').filter({ visible: true });
    assert.equal(await recipient.inputValue(), state.email);
    await page.waitForTimeout(400);
    const box = await recipient.boundingBox(); assert.ok(box.width < 650 && box.x > 100);
    await page.getByRole('button', { name: 'Enviar desde JUNTO', exact: true }).waitFor();
    // Do not press send: actual Gmail delivery was already validated in the prior release.
    await page.getByRole('button', { name: 'Volver a las opciones para compartir', exact: true }).click();
    await page.getByRole('button', { name: 'Cerrar vista para compartir', exact: true }).click();
    await page.getByRole('link', { name: 'Perfil y ajustes', exact: true }).click();
    await page.getByRole('button', { name: /Cerrar sesión/ }).click();
    await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
    await page.waitForURL(/\/login/);
    assert.equal(await page.evaluate(() => sessionStorage.getItem('junto.session.accessToken')), null);
    assert.deepEqual(errors, []);
    console.log(`PASS production responsive ${engine === chromium ? 'Chromium' : 'WebKit'}: existing QA login/logout, six widths, group, email preparation. No email sent.`);
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
