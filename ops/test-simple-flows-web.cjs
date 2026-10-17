// Real compiled screens and fictional API only: never writes to a real user's group.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
require('ts-node').register({ transpileOnly: true, skipProject: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node', target: 'ES2022' } });
const { calculateAccounts } = require('../apps/api/src/domain/accounts.ts');
const { allocateEqual } = require('../apps/api/src/domain/money.ts');
const build = path.resolve(process.argv[2] || 'apps/mobile/dist-beta');
const artifacts = path.resolve('ops/artifacts/simple-ux');
fs.mkdirSync(artifacts, { recursive: true });
const server = require('./web/server.cjs').createServer(build);
const uid = 'b24a0000-1111-4111-8111-000000000010', gid = 'b24a0000-1111-4111-8111-000000000001';
const people = [{ id: uid, nombre: 'Ana QA', email: 'ana@example.invalid', emailVerificado: true, tienePassword: true }, { id: 'b24a0000-1111-4111-8111-000000000011', nombre: 'Luis QA', celular: '999000001' }];
const user = people[0], now = new Date().toISOString();
const original = [{ montoTotal: 6000, pagadoPor: people[1].id, participantes: people.map(p => ({ usuarioId: p.id, montoAsignado: 3000 })) }];
const initial = calculateAccounts(people, original, [], false);
const baseGroup = { id: gid, nombre: 'Paseo de prueba', tipo: 'amigos', moneda: 'PEN', estado: 'abierto', rolUsuario: 'admin', aprobacionPagos: 'receptor', miembros: people.map(p => ({ usuarioId: p.id, usuario: p, rol: 'miembro' })), resumen: initial, saldos: initial.saldos, balanceUsuario: { debes: 3000, teDeben: 0, neto: -3000 }, pagosPorConfirmar: 0 };
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
(async () => {
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), headless: true });
  try {
    for (const width of [320, 390, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 850 } });
      const errors = [], sent = [], posts = [];
      let currentGroup = structuredClone(baseGroup);
      const ledger = structuredClone(original);
      let preflightGate = null, preflightSeen = null, loseAnswer = false;
      await context.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (!url.pathname.startsWith('/api/')) return url.origin === origin ? route.continue() : route.abort();
        const p = url.pathname.slice(4), method = req.method();
        const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*' };
        if (method === 'OPTIONS') return route.fulfill({ status: 204, headers });
        let body = [], status = 200;
        if (p === '/auth/me') body = user;
        else if (p === '/grupos') body = [currentGroup];
        else if (p === `/grupos/${gid}`) {
          if (preflightGate) { const gate = preflightGate; preflightGate = null; preflightSeen.resolve(); await gate.promise; }
          body = currentGroup;
        } else if (p === `/grupos/${gid}/gastos` && method === 'POST') {
          const payload = req.postDataJSON(); sent.push(payload);
          if (!posts.some(x => x.solicitudId === payload.solicitudId)) {
            posts.push(payload);
            ledger.push({ ...payload, participantes: allocateEqual(payload.montoTotal, payload.participantes.map(p => p.usuarioId)) });
            const resumen = calculateAccounts(people, ledger, [], false);
            const me = resumen.cuentas.find(p => p.usuarioId === uid);
            currentGroup = { ...currentGroup, resumen, saldos: resumen.saldos, balanceUsuario: { debes: resumen.saldos.filter(s => s.deudorId === uid).reduce((a,b) => a+b.monto,0), teDeben: resumen.saldos.filter(s => s.acreedorId === uid).reduce((a,b) => a+b.monto,0), neto: me.neto } };
          }
          if (loseAnswer) { loseAnswer = false; return route.abort('failed'); }
          status = 201; body = { ...payload, id: 'b24a0000-1111-4111-8111-000000000099', grupoId: gid };
        } else if (p === `/grupos/${gid}/gastos` && method === 'GET') {
          body = { gastos: ledger.map((expense, index) => ({ ...expense, id: `b24a0000-1111-4111-8111-${String(index + 100).padStart(12, '0')}`, grupoId: gid, descripcion: expense.descripcion || 'Gasto inicial', categoria: expense.categoria || 'otro', fecha: now, pagador: people.find(person => person.id === expense.pagadoPor), participantes: expense.participantes.map(part => ({ ...part, usuario: people.find(person => person.id === part.usuarioId) })) })), total: ledger.length, totalPages: 1 };
        } else if (p === '/pagos/reportar') {
          body = { ...req.postDataJSON(), id: 'fictional-payment', pagadorId: uid, estado: 'reportado' }; status = 201;
        }
        return route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(body) });
      });
      // A blank draft left by an interrupted visit must initialize its participants on reopening.
      await context.addInitScript(({ uid, gid, user, now }) => {
        sessionStorage.setItem('junto.session.accessToken', 'fictional-token');
        sessionStorage.setItem('junto.session.cachedUsuario', JSON.stringify(user));
        if (!localStorage.getItem('qa.draftSeeded')) {
          localStorage.setItem('qa.draftSeeded', '1');
          localStorage.setItem(`junto.expenseDraft.v1.${uid}.${gid}`, JSON.stringify({ amount: '', description: '', payer: uid, ids: [], mode: 'igual', values: {}, category: 'otro', categoryPicked: false, text: '', notes: '', date: now, requestId: 'blank-draft-fixture', savedAt: now }));
        }
      }, { uid, gid, user, now });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      const fit = async name => {
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `${name}: horizontal overflow at ${width}`);
        await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true });
      };
      await page.goto(`${origin}/app/gastos/agregar?grupoId=${gid}`);
      await page.getByLabel('Monto total en PEN', { exact: true }).waitFor();
      await page.getByText('4. ¿Entre quiénes se divide?', { exact: true }).waitFor();
      assert.equal(await page.getByRole('checkbox', { checked: true }).count(), 2);
      assert.equal(await page.getByText('¿Se repite?', { exact: true }).count(), 0);
      assert.equal(await page.getByLabel('Nota del gasto', { exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
      await page.getByText(/Escribe un monto mayor que cero/).waitFor();
      await page.getByLabel('Monto total en PEN', { exact: true }).fill('120');
      await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
      await page.getByText(/Escribe en qué gastaste/).waitFor();
      await page.getByLabel('Descripción del gasto', { exact: true }).fill('Almuerzo');
      await page.getByText('5. A cada uno le toca', { exact: true }).waitFor();
      assert.equal(await page.getByText(/S\/\s*60[.,]00/, { exact: true }).count(), 2);
      await fit('gasto-simple');
      await page.getByRole('button', { name: 'Más opciones', exact: true }).click();
      await page.getByLabel('Nota del gasto', { exact: true }).fill('Comida de prueba');
      await page.getByRole('button', { name: 'Menos opciones', exact: true }).click();
      preflightGate = deferred(); preflightSeen = deferred(); const gate = preflightGate;
      await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
      await preflightSeen.promise;
      const saving = page.getByRole('button', { name: 'Guardando gasto…', exact: true });
      assert.ok(await saving.isDisabled(), 'saving is visible and blocks a second tap during preflight');
      assert.equal(sent.length, 0); gate.resolve();
      await page.getByText('✓ Gasto guardado', { exact: true }).waitFor();
      assert.equal(posts.length, 1); assert.equal(posts[0].montoTotal, 12000);
      assert.equal(posts[0].participantes.length, 2); assert.equal(posts[0].notas, 'Comida de prueba');
      await page.getByText('Luis QA te debe', { exact: true }).waitFor();
      await fit('grupo');
      assert.equal(await page.getByRole('button', { name: 'Buscar movimientos', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Sacar cuentas · quién paga a quién', exact: true }).waitFor();
      // A committed write whose response is lost must retry the identical frozen payload.
      await page.goto(`${origin}/app/gastos/agregar?grupoId=${gid}`);
      await page.getByLabel('Monto total en PEN', { exact: true }).fill('10.01');
      await page.getByLabel('Descripción del gasto', { exact: true }).fill('Taxi');
      loseAnswer = true;
      await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
      await page.getByText(/No sabemos si se guardó/).waitFor();
      const uncertain = sent.at(-1);
      await page.getByRole('button', { name: 'Comprobar y reintentar', exact: true }).click();
      await page.getByText('✓ Gasto guardado', { exact: true }).waitFor();
      assert.deepEqual(sent.at(-1), uncertain); assert.equal(posts.length, 2);
      currentGroup = structuredClone(baseGroup); // Independent payment fixture: Ana owes Luis S/30.
      await page.goto(`${origin}/app/pagos/pagar?grupoId=${gid}&acreedorId=${people[1].id}`);
      await page.getByLabel('Monto del pago en PEN', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Monto del pago en PEN', { exact: true }).inputValue(), '30.00');
      assert.equal(await page.getByRole('radio', { name: 'Hoy', exact: true }).count(), 0);
      await page.getByRole('button', { name: 'Adjuntar comprobante (opcional)', exact: true }).waitFor();
      await fit('pago-simple');
      await page.getByRole('button', { name: 'Más detalles del pago', exact: true }).click();
      await page.getByRole('radio', { name: 'Hoy', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Más detalles del pago', exact: true }).click();
      await page.getByLabel('Monto del pago en PEN', { exact: true }).fill('30.01');
      assert.ok(await page.getByRole('button', { name: 'Avisar que ya pagué', exact: true }).isDisabled());
      await page.getByLabel('Monto del pago en PEN', { exact: true }).fill('10');
      await page.getByRole('button', { name: 'Avisar que ya pagué', exact: true }).click();
      await page.getByText('Enviado para aprobación', { exact: true }).waitFor();
      await page.getByText(/Tu deuda todavía no cambia/).waitFor();
      await page.goto(`${origin}/app/`);
      await page.getByRole('heading', { name: 'Hola, Ana' }).waitFor();
      assert.equal(await page.getByText('Balance neto', { exact: true }).count(), 0);
      await fit('inicio');
      // Enlarge rendered text to exercise wrapping in the actual compiled layouts.
      await page.locator('[dir="auto"]').evaluateAll(nodes => nodes.forEach(node => {
        const style = getComputedStyle(node);
        node.style.fontSize = `${parseFloat(style.fontSize) * 2}px`;
        node.style.lineHeight = `${parseFloat(style.lineHeight) * 2}px`;
      }));
      await fit('inicio-texto-ampliado');
      assert.deepEqual(errors, []);
      console.log(`PASS ${width}px: blank draft, validation, preflight feedback, exact save, uncertain retry, simple group/payment and debt cap`);
      await context.close();
    }
  } finally { await browser.close(); await new Promise(r => server.close(r)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
