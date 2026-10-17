// Isolated UI fixtures, not backend/E2E delivery proof. No production requests or real accounts.
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const fixtureApi = process.env.JUNTO_LAYOUT_API_ORIGIN || 'http://127.0.0.1:3005';
assert.ok(['http://127.0.0.1:3005', 'https://junto.lunalav.pe'].includes(fixtureApi));
process.env.WEB_API_ORIGIN = fixtureApi;
const { createServer } = require('./web/server.cjs');
const root = path.resolve(process.argv[2] || path.join(__dirname, '../apps/mobile/dist-ux-qa'));
const uid = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const gid = '33333333-3333-4333-8333-333333333333';
const eid = '44444444-4444-4444-8444-444444444444';
const date = '2026-10-17T15:00:00.000Z';
const user = { id: uid, nombre: 'Caleb QA', email: 'qa@example.invalid', emailVerificado: true, fechaRegistro: date };
const friend = { id: other, nombre: 'Yesenia QA', email: 'friend@junto.invalid', sinCuenta: true };
function fixtures() {
  const group = { id: gid, nombre: 'Paseo Churín QA', tipo: 'viaje', moneda: 'PEN', pais: 'PE', creadoPor: uid, fechaCreacion: date, activo: true, estado: 'abierto', rolUsuario: 'admin', noLeidos: 2,
    miembros: [user, friend].map((person, index) => ({ id: `member-${index}`, grupoId: gid, usuarioId: person.id, rol: index ? 'miembro' : 'admin', activo: true, fechaUnion: date, usuario: person })),
    resumen: { totalGastado: 8000, cantidadGastos: 1, cuentas: [
      { usuarioId: uid, nombre: user.nombre, pagaste: 8000, tuParte: 4000, pagosEnviados: 0, pagosRecibidos: 0, neto: 4000 },
      { usuarioId: other, nombre: friend.nombre, pagaste: 0, tuParte: 4000, pagosEnviados: 0, pagosRecibidos: 0, neto: -4000 }],
      saldos: [{ deudorId: other, deudorNombre: friend.nombre, acreedorId: uid, acreedorNombre: user.nombre, monto: 4000 }] },
    balanceUsuario: { teDeben: 4000, debes: 0, neto: 4000 } };
  const expense = { id: eid, grupoId: gid, descripcion: 'Almuerzo QA', montoTotal: 8000, pagadoPor: uid, pagador: user, creador: user, categoria: 'comida', fecha: date, activo: true,
    participantes: [user, friend].map(person => ({ usuarioId: person.id, usuario: person, montoAsignado: 4000 })) };
  return { group, expense };
}
async function run() {
  assert.ok(fs.existsSync(path.join(root, 'index.html')), 'Build the isolated dist-ux-qa export first');
  const server = createServer(root);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROME_BIN || (process.platform === 'win32' ? 'C:/Program Files/Google/Chrome/Application/chrome.exe' : '/usr/bin/google-chrome'), headless: true });
  let page;
  const debug = [];
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 900 }, reducedMotion: 'reduce' });
    const { group, expense } = fixtures();
    let chatReads = 0; let saved = []; let created = []; let payments = []; let expensesFail = false; let listed = [group];
    const errors = []; const unexpected = [];
    await context.addInitScript(() => { sessionStorage.setItem('junto.session.accessToken', 'fictional-qa-only'); sessionStorage.setItem('junto.session.refreshToken', 'fictional-qa-only'); });
    await context.route('**/*', async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.pathname.includes('/api/')) debug.push(`${request.method()} ${url.origin}${url.pathname}`);
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      // Production API requests are fulfilled here, NEVER continued to its server.
      if (!url.pathname.startsWith('/api/') || url.origin !== fixtureApi) { unexpected.push(url.origin); return route.abort(); }
      const headers = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'authorization,content-type,x-junto-currency-version', 'Access-Control-Allow-Methods': 'GET,POST,PUT,OPTIONS' };
      if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
      const target = url.pathname.slice(4);
      const json = (data, status = 200) => route.fulfill({ status, headers, contentType: 'application/json', body: JSON.stringify(data) });
      if (target === '/auth/me') return json(user);
      if (target === '/grupos' && request.method() === 'GET') return json(listed);
      if (target === '/grupos' && request.method() === 'POST') { created.push(request.postDataJSON()); return json({ ...group, id: gid }); }
      if (target === `/grupos/${gid}`) return json(group);
      if (target === `/grupos/${gid}/gastos` && request.method() === 'GET') return expensesFail ? json({ error: 'QA offline fixture' }, 503) : json({ gastos: [expense], total: 1, totalPages: 1 });
      if (target === `/grupos/${gid}/gastos` && request.method() === 'POST') { saved.push(request.postDataJSON()); return json(expense); }
      if (target === `/grupos/${gid}/chat`) { chatReads++; return json([{ id: 'qa-message', tipo: 'mensaje', comentarioId: 'qa-comment', fecha: date, autor: friend, mio: false, texto: 'Hola desde el chat QA', eliminado: false, puedeEliminar: true }]); }
      if (target === `/grupos/${gid}/presencia`) return json([]);
      if (target === '/pagos' || target === '/pagos/historial') return json(payments);
      if (target === '/actividad') return json([{ id: 'qa-event', tipo: 'gasto', titulo: 'Almuerzo QA', detalle: 'Paseo Churín QA', monto: 8000, moneda: 'PEN', fecha: date, grupoId: gid, gastoId: eid, pagoId: null, requiereAccion: false }]);
      if (['/cuentas-rapidas', '/invitaciones', '/notificaciones'].includes(target)) return json([]);
      unexpected.push(`${request.method()} ${target}`); return json({ error: 'Unexpected fixture endpoint' }, 500);
    });
    page = await context.newPage(); page.setDefaultTimeout(10000);
    page.on('console', message => { if (message.type() === 'error') debug.push(message.text().slice(0, 500)); });
    page.on('pageerror', error => errors.push(error.message));
    const artifacts = path.join(__dirname, 'artifacts'); fs.mkdirSync(artifacts, { recursive: true });
    async function layout(label, screenshot = false) {
      await page.waitForTimeout(180);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `No page overflow: ${label}`);
      const boxes = await page.locator('input:visible').evaluateAll(inputs => inputs.map(input => { const b = input.getBoundingClientRect(); return { x: b.x, right: b.right, width: b.width }; }));
      for (const box of boxes) assert.ok(box.x >= -1 && box.right <= page.viewportSize().width + 1 && box.width >= 30, `Input within viewport: ${label}`);
      if (screenshot) await page.screenshot({ path: path.join(artifacts, `group-layout-${label}.png`) });
    }
    await page.goto(origin + '/app/', { waitUntil: 'networkidle' });
    const create = page.getByRole('button', { name: 'Crear grupo', exact: true });
    await create.waitFor(); assert.ok((await create.boundingBox()).height >= 64, 'Main create button remains large for returning users');
    await page.getByText('Actividad reciente', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Ya pagué', exact: true }).count(), 0);
    await layout('home-390', true);
    await create.click();
    await page.getByLabel('Nombre del grupo', { exact: true }).fill('Viaje QA');
    assert.equal(await page.getByRole('button', { name: /País del plan:/ }).count(), 0, 'Options collapsed initially');
    await page.getByRole('button', { name: 'Opciones del grupo', exact: true }).click();
    await page.getByRole('button', { name: /Moneda del grupo:/ }).waitFor();
    await page.getByRole('button', { name: /Moneda del grupo:/ }).click();
    await page.getByRole('radio', { name: /Dólares estadounidenses/ }).click();
    await page.getByRole('button', { name: 'Opciones del grupo', exact: true }).click();
    await page.getByRole('button', { name: 'Agregar persona', exact: true }).click();
    await page.getByLabel('Nombre de la persona', { exact: true }).fill('Ana QA');
    await page.getByRole('button', { name: 'Crear grupo', exact: true }).last().click();
    assert.equal(created.length, 0, 'Do not silently drop a typed, not-yet-added member');
    await page.getByRole('button', { name: 'Agregar persona', exact: true }).click();
    await page.getByRole('button', { name: 'Quitar a Ana QA', exact: true }).waitFor();
    assert.equal(await page.getByText('Te falta agregar a esa persona. Pulsa «Agregar» junto a su nombre y luego crea el grupo.', { exact: true }).count(), 0, 'Validation clears after the member is added');
    await layout('create-390', true);
    await page.getByRole('button', { name: 'Crear grupo con 2 personas', exact: true }).click();
    assert.equal(created.length, 1); assert.equal(created[0].moneda, 'USD'); assert.deepEqual(created[0].integrantes, ['Ana QA']);
    await page.getByRole('tab', { name: 'Cuentas', exact: true }).waitFor();
    await page.getByText('Yesenia QA te debe', { exact: true }).waitFor();
    assert.equal(chatReads, 0, 'Accounts must not fetch/mark chat read');
    await page.getByRole('button', { name: /Ver gasto/ }).waitFor();
    await layout('group-390', true);
    for (const width of [320, 360, 768, 1024, 1440]) { await page.setViewportSize({ width, height: 900 }); await layout(`group-${width}`, width === 1440); }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('tab', { name: /Chat/ }).click();
    await page.getByText('Hola desde el chat QA', { exact: true }).waitFor(); assert.ok(chatReads > 0);
    await page.getByLabel('Escribe un mensaje al grupo', { exact: true }).fill('Borrador sin enviar');
    await page.getByRole('tab', { name: 'Cuentas', exact: true }).click();
    await page.getByRole('tab', { name: /Chat/ }).click();
    assert.equal(await page.getByLabel('Escribe un mensaje al grupo', { exact: true }).inputValue(), 'Borrador sin enviar');
    await layout('chat-390', true);
    await page.getByRole('tab', { name: 'Cuentas', exact: true }).click();
    await page.getByRole('button', { name: '＋ Agregar gasto', exact: true }).click();
    await page.getByLabel('Monto total en PEN', { exact: true }).fill('80');
    await page.getByLabel('Descripción del gasto', { exact: true }).fill('Cena QA');
    await page.getByText('5. A cada uno le toca', { exact: true }).waitFor();
    // Voice and receipt are shortcuts above the form (they save typing), always one tap away.
    await page.getByRole('button', { name: 'Dictar con voz', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Escanear boleta con cámara', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Subir foto de boleta', exact: true }).waitFor();
    assert.ok(await page.getByRole('radio', { name: 'Caleb QA', exact: true }).getAttribute('aria-checked') === 'true');
    for (const width of [320, 390, 768, 1440]) { await page.setViewportSize({ width, height: 900 }); await layout(`expense-${width}`, width === 390 || width === 1440); }
    await page.setViewportSize({ width: 390, height: 900 });
    await page.getByRole('checkbox', { name: 'Yesenia QA', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Tú', exact: true }).click();
    await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
    assert.equal(saved.length, 0, 'Empty split cannot be saved');
    await page.getByRole('checkbox', { name: 'Tú', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Yesenia QA', exact: true }).click();
    await page.getByRole('button', { name: 'Cambiar tipo de reparto', exact: true }).click();
    await page.getByRole('radio', { name: /Por montos. Cada uno/ }).click();
    await page.getByLabel('Parte de Tú', { exact: true }).fill('30');
    await page.getByLabel('Parte de Yesenia', { exact: true }).fill('30');
    await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click(); assert.equal(saved.length, 0, '60 must not save against an 80 total');
    await page.getByLabel('Parte de Yesenia', { exact: true }).fill('50');
    await page.getByRole('button', { name: 'Guardar gasto', exact: true }).click();
    await page.getByText('✓ Gasto guardado', { exact: true }).waitFor();
    assert.equal(saved.length, 1); assert.equal(saved[0].montoTotal, 8000); assert.equal(saved[0].participantes.reduce((sum, p) => sum + p.monto, 0), 8000);
    payments = [{ id: '55555555-5555-4555-8555-555555555555', grupoId: gid, pagadorId: other, receptorId: uid, monto: 4000, estado: 'reportado', permisos: { aprobar: true } }];
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByRole('button', { name: 'Revisar pago recibido', exact: true }).waitFor();
    await page.getByText(/La deuda baja al confirmar/).waitFor();
    expensesFail = true;
    await page.reload({ waitUntil: 'networkidle' });
    await page.getByText('No pudimos cargar los gastos. Esto no significa que no haya gastos.', { exact: true }).waitFor({ timeout: 20000 });
    expensesFail = false;
    listed = [group, { ...group, id: '66666666-6666-4666-8666-666666666666', nombre: 'Viaje Colombia QA', moneda: 'COP', balanceUsuario: { teDeben: 999999999, debes: 0, neto: 999999999 } }];
    await page.goto(origin + '/app/', { waitUntil: 'networkidle' });
    await page.getByText('COP', { exact: true }).waitFor();
    for (const width of [320, 390, 1440]) { await page.setViewportSize({ width, height: 900 }); await layout(`home-multicurrency-${width}`, width === 390); }
    assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
    console.log('PASS local UI fixtures: large create action, collapsed options/currency, typed member validation, accounts/chat separation, preserved chat draft, responsive layouts, exact split guard, pending payment and expense error. No real messages, accounts or payments created.');
  } catch (error) {
    if (page) { console.error('Fixture failure URL:', page.url()); console.error(debug.slice(0, 20)); console.error((await page.locator('body').innerText()).slice(0, 3500)); await page.screenshot({ path: path.join(__dirname, 'artifacts/group-layout-failure.png') }); }
    throw error;
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
