// Visual previews of the main screens for docs/junto-ux-audit: the SAME React Native code rendered by the
// web export at phone width (and one desktop width), against a local API with fictional data.
// This is not a native Android/iOS render. Every request stays in loopback; nothing reaches production.
// Usage: DATABASE_URL=<local QA db> JUNTO_QA_WEB_PORT=8091 node ops/ux-previews.cjs <before|after>
//        (web export served by ops/web/server.cjs on that port; `npm run build` in apps/api first)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const label = process.argv[2] || 'after';
const out = path.join(__dirname, '../docs/junto-ux-audit/screens', label);
const WEB = `http://127.0.0.1:${Number(process.env.JUNTO_QA_WEB_PORT || 8090)}`;
const API_PORT = 3039;
const suffix = Date.now();

async function run() {
  fs.mkdirSync(out, { recursive: true });
  const server = helpers.startApi(API_PORT, {});
  let browser;
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body) {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json();
      assert.ok(response.ok, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function account(nombre, slug) {
      const email = `qa-ux-${slug}-${suffix}@example.invalid`;
      const password = `Preview${suffix}!`;
      await call('/auth/register', null, 'POST', { nombre, email, password });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return { email, password, ...(await call('/auth/verify-email', null, 'POST', { email, otp: otpCode })) };
    }
    const caleb = await account('Caleb Luna', 'caleb');
    const ana = await account('Andrea Ríos', 'andrea');
    const id = (user) => user.usuario.id;

    // Trip: Andrea joins with the app; Marco and Lucía are added by name.
    const trip = await call('/grupos', caleb, 'POST', { nombre: 'Viaje a Cusco', tipo: 'viaje', integrantes: ['Andrea', 'Marco', 'Lucía'] });
    let detail = await call(`/grupos/${trip.id}`, caleb);
    const byName = (group, name) => group.miembros.find((m) => m.usuario.nombre.startsWith(name)).usuarioId;
    await call('/grupos/unirse', ana, 'POST', { link: trip.linkInvitacion, como: byName(detail, 'Andrea') });
    detail = await call(`/grupos/${trip.id}`, caleb);
    const everyone = detail.miembros.map((m) => ({ usuarioId: m.usuarioId }));
    const marco = byName(detail, 'Marco');
    const lucia = byName(detail, 'Luc');
    const expense = (user, body) => call(`/grupos/${trip.id}/gastos`, user, 'POST', { tipoDivision: 'igual', participantes: everyone, ...body });
    await expense(caleb, { descripcion: 'Hotel en San Blas', montoTotal: 64000, pagadoPor: id(caleb), categoria: 'alojamiento' });
    await expense(ana, { descripcion: 'Tour Valle Sagrado', montoTotal: 20000, pagadoPor: id(ana), categoria: 'entretenimiento' });
    await expense(caleb, { descripcion: 'Cena en Pachapapa', montoTotal: 18000, pagadoPor: marco, categoria: 'comida', participantes: [{ usuarioId: id(caleb) }, { usuarioId: id(ana) }, { usuarioId: marco }] });
    await expense(caleb, { descripcion: 'Taxi al aeropuerto', montoTotal: 6000, pagadoPor: id(caleb), categoria: 'transporte' });
    // Andrea reports a Yape payment to Caleb (pending until he confirms); Lucía paid cash, recorded by Caleb.
    await call('/pagos/reportar', ana, 'POST', { grupoId: trip.id, receptorId: id(caleb), monto: 5000, metodo: 'yape' });
    await call('/pagos/recibido', caleb, 'POST', { grupoId: trip.id, pagadorId: lucia, monto: 10000, metodo: 'efectivo' });
    // Home: a second group so the list and the totals have more than one row.
    const depa = await call('/grupos', caleb, 'POST', { nombre: 'Depa Miraflores', tipo: 'roomies', integrantes: ['Sofía', 'Diego'] });
    const depaDetail = await call(`/grupos/${depa.id}`, caleb);
    await call(`/grupos/${depa.id}/gastos`, caleb, 'POST', { descripcion: 'Internet de octubre', montoTotal: 12000, pagadoPor: byName(depaDetail, 'Sofía'), tipoDivision: 'igual', categoria: 'otro', participantes: depaDetail.miembros.map((m) => ({ usuarioId: m.usuarioId })) });

    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    async function shoot(width, height, shots) {
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
      await context.route('**/*', async (route) => {
        const request = route.request(); const url = new URL(request.url());
        if (url.origin === WEB) return route.continue();
        if (url.origin === 'https://junto.lunalav.pe' && url.pathname.startsWith('/api/')) {
          const cors = { 'Access-Control-Allow-Origin': WEB, 'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE', 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version' };
          if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
          const result = await fetch(`http://127.0.0.1:${API_PORT}${url.pathname}${url.search}`, { method: request.method(), headers: { ...request.headers(), host: `127.0.0.1:${API_PORT}` }, body: request.postData() || undefined });
          if (result.status >= 400) console.log(`  [api ${result.status}] ${request.method()} ${url.pathname}`);
          return route.fulfill({ status: result.status, body: Buffer.from(await result.arrayBuffer()), headers: { 'Content-Type': result.headers.get('content-type') || 'application/json', ...cors } });
        }
        return route.abort('blockedbyclient');
      });
      const page = await context.newPage();
      await page.goto(`${WEB}/app/login`, { waitUntil: 'networkidle' });
      await page.getByLabel('Correo electrónico').fill(caleb.email);
      await page.getByLabel('Contraseña', { exact: true }).fill(caleb.password);
      await page.getByRole('button', { name: 'Iniciar sesión →' }).click();
      await page.getByText(/^Hola, /).first().waitFor({ timeout: 20000 }).catch(async (error) => { await page.screenshot({ path: path.join(out, 'debug-login.png') }); throw error; });
      // The first-steps guide is for new people; close it once so the screens are visible.
      const later = page.getByRole('button', { name: 'Lo veré después' });
      if (await later.count()) await later.first().click();
      for (const [name, route, act] of shots) {
        await page.goto(`${WEB}/app${route}`, { waitUntil: 'networkidle' });
        await page.waitForTimeout(1200);
        if (act) await act(page);
        await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: name.endsWith('-completo') });
        console.log(`  ${label}/${name}.png`);
      }
      await context.close();
    }
    const phone = [
      ['01-home', '/'],
      ['02-grupo-chat', `/grupos/${trip.id}`],
      ['03-cuentas-explicadas', `/cuentas/${trip.id}`],
      ['04-nuevo-gasto', `/gastos/agregar?grupoId=${trip.id}`],
      ['05-resumen-cuentas', '/cuentas/resumen'],
      ['06-actividad', '/actividad'],
      ['07-perfil', '/perfil'],
      ['08-registrar-pago', `/pagos/pagar?grupoId=${trip.id}`],
    ];
    await shoot(390, 844, phone);
    // Full-length versions of the long screens.
    // "Por participaciones": Marco 2, the rest 1, on S/ 100.01.
    const shares = async (page) => {
      await page.getByLabel(/^Monto total en/).first().fill('100.01');
      const option = page.getByRole('radio', { name: /Por participaciones/ });
      if (await option.count()) { await option.click(); await page.getByLabel('Parte de Marco').fill('2'); }
      await page.waitForTimeout(400);
    };
    await shoot(390, 3000, [['09-gasto-participaciones', `/gastos/agregar?grupoId=${trip.id}`, shares], ['01-home-completo', '/'], ['03-cuentas-explicadas-completo', `/cuentas/${trip.id}`], ['04-nuevo-gasto-completo', `/gastos/agregar?grupoId=${trip.id}`]]);
    await shoot(1440, 900, [['10-home-escritorio', '/']]);
    fs.writeFileSync(path.join(out, 'README.md'), `# Capturas «${label}»\n\nGeneradas por \`ops/ux-previews.cjs\` el ${new Date().toISOString().slice(0, 10)}: export web del mismo código React Native, Chromium a 390×844 (y 1440×900), API y base LOCALES con datos ficticios. No son capturas nativas de Android/iOS.\n`);
  } catch (error) {
    console.error(server.log().split(String.fromCharCode(10)).filter((line) => /error/i.test(line)).slice(-8).join(String.fromCharCode(10)));
    throw error;
  } finally { if (browser) await browser.close(); server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
