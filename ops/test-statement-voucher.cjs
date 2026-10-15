// Local QA: native payer uploads a fictional capture; verify notebook + both exports before/after approval.
// seed -> use JUNTO QA to report the payment -> pending -> confirm. No external payments or messages.
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const { randomUUID, randomInt } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const ExcelJS = require('exceljs');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const origin = require('./local-qa.cjs').localQa();
const db = new PrismaClient();
const folder = 'ops/artifacts/statement-voucher';
const metadataPath = `${folder}/scenario.json`;
const mode = process.argv[2];
async function token(id) {
  const u = await db.usuario.findUniqueOrThrow({ where: { id } });
  assert.ok(u.email.endsWith('@example.invalid') && u.emailVerificado && !u.sinCuenta, 'Fictional verified QA accounts only');
  return jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' });
}
async function call(route, id, method = 'GET', body, expected = 200) {
  const r = await fetch(origin + route, { method, headers: { Authorization: `Bearer ${await token(id)}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: body ? JSON.stringify(body) : undefined });
  const data = await r.json(); assert.equal(r.status, expected, `${route}: ${JSON.stringify(data)}`); return data;
}
async function snapshot(scenario, stage) {
  const { groupId, viewerId, receiverId, observerId } = scenario;
  const payment = await db.pago.findFirstOrThrow({ where: { grupoId: groupId, pagadorId: viewerId }, include: { comprobante: true } });
  assert.ok(payment.comprobante, 'The native payment has its own attached voucher');
  assert.equal(payment.monto, 2500); assert.equal(payment.metodo, 'yape');
  assert.equal(payment.fechaEfectiva.toISOString().slice(0, 10), '2026-10-14');
  const confirmed = stage === 'confirmado';
  assert.equal(payment.estado, confirmed ? 'exitoso' : 'reportado');
  const views = await Promise.all([viewerId, receiverId, observerId].map(id => call(`/grupos/${groupId}/estado-cuenta`, id)));
  for (const [index, view] of views.entries()) {
    const id = [viewerId, receiverId, observerId][index];
    const ledger = await call(`/grupos/${groupId}`, id);
    assert.equal(view.totales.saldo, ledger.resumen.cuentas.find(c => c.usuarioId === id).neto);
  }
  const s = views[0];
  assert.equal(s.totales.saldo, confirmed ? 0 : -2500);
  assert.deepEqual(s.balance, { teDeben: 0, debes: confirmed ? 0 : 2500 });
  const row = s.movimientos.find(m => m.id === payment.id);
  assert.ok(row.conComprobante); assert.equal(row.efecto, confirmed ? 2500 : 0);
  assert.equal(row.fecha, '2026-10-14');
  assert.ok(!views[2].movimientos.some(m => m.id === payment.id), 'Other people do not get this payment in their own notebook');
  await call(`/pagos/${payment.id}/comprobante`, observerId, 'GET', undefined, 404);
  const image = await call(`/pagos/${payment.id}/comprobante`, viewerId);
  assert.ok(image.imagen && /^image\//.test(image.mime));
  await fs.writeFile(`${folder}/${stage}.json`, JSON.stringify(s, null, 2));
  for (const formato of ['pdf', 'xlsx']) {
    const r = await fetch(`${origin}/grupos/${groupId}/estado-cuenta/archivo?formato=${formato}&version=${s.version}&zona=UTC`, { headers: { Authorization: `Bearer ${await token(viewerId)}` } });
    assert.equal(r.status, 200); const bytes = Buffer.from(await r.arrayBuffer());
    await fs.writeFile(`${folder}/${stage}.${formato}`, bytes);
    if (formato === 'xlsx') {
      const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
      assert.equal(wb.getWorksheet('Resumen').getCell('B6').value, confirmed ? 0 : 25);
      assert.equal(wb.getWorksheet('Resumen').getCell('B7').result, confirmed ? 0 : -25);
      assert.equal(wb.getWorksheet('Movimientos').getCell('M3').value, 'Sí (en JUNTO)');
      assert.equal(wb.getWorksheet('Movimientos').getCell('H3').value, confirmed ? 25 : 0);
      assert.equal(wb.getWorksheet('Movimientos').getCell('K3').result, confirmed ? 0 : -25);
      assert.equal(wb.getWorksheet('Movimientos').getCell('A3').value.toISOString().slice(0, 10), '2026-10-14');
    }
  }
  return payment;
}
async function run() {
  await fs.mkdir(folder, { recursive: true });
  if (mode === 'seed') {
    const viewerId = process.env.JUNTO_QA_VIEWER_ID;
    assert.ok(viewerId, 'Set the fictional account currently open in JUNTO QA'); await token(viewerId);
    const suffix = randomUUID();
    const receiver = await db.usuario.create({ data: { nombre: 'Marta Ríos', email: `qa-statement-receiver-${suffix}@example.invalid`, passwordHash: 'fictional-no-login', emailVerificado: true } });
    const observer = await db.usuario.create({ data: { nombre: 'Observador QA', email: `qa-statement-observer-${suffix}@example.invalid`, passwordHash: 'fictional-no-login', emailVerificado: true } });
    const group = await db.grupo.create({ data: { nombre: 'QA Captura y cuaderno', creadoPor: viewerId, miembros: { create: [viewerId, receiver.id, observer.id].map(usuarioId => ({ usuarioId, rol: usuarioId === viewerId ? 'admin' : 'miembro' })) } } });
    await call(`/grupos/${group.id}/gastos`, viewerId, 'POST', { descripcion: 'Almuerzo de prueba', montoTotal: 7500, pagadoPor: receiver.id, tipoDivision: 'igual', categoria: 'comida', participantes: [viewerId, receiver.id, observer.id].map(usuarioId => ({ usuarioId })), fecha: '2026-10-14T18:00:00Z' }, 201);
    await fs.writeFile(metadataPath, JSON.stringify({ groupId: group.id, viewerId, receiverId: receiver.id, observerId: observer.id }, null, 2));
    execFileSync(process.env.JUNTO_QA_PYTHON || (process.platform === 'win32' ? 'python' : 'python3'), [path.join(__dirname, 'create-voucher-fixture.py'), '--operacion', String(randomInt(10000000, 99999999)), '--destinatario', receiver.nombre, '--fecha', '14 oct. 2026', '--salida', `${folder}/captura-qa.png`]);
    console.log('READY: QA Captura y cuaderno. Reporta S/25 a Marta Ríos con la captura ficticia desde la app.'); return;
  }
  const scenario = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
  if (mode === 'add-cent') {
    assert.ok(!scenario.liveExpenseId, 'Live refresh case is already seeded');
    const expense = await call(`/grupos/${scenario.groupId}/gastos`, scenario.receiverId, 'POST', { descripcion: 'Ajuste QA de un céntimo', montoTotal: 1, pagadoPor: scenario.receiverId, tipoDivision: 'exacto', categoria: 'otro', participantes: [{ usuarioId: scenario.viewerId, monto: 1 }] }, 201);
    scenario.liveExpenseId = expense.id; await fs.writeFile(metadataPath, JSON.stringify(scenario, null, 2));
    assert.equal((await call(`/grupos/${scenario.groupId}/estado-cuenta`, scenario.viewerId)).totales.saldo, -1);
    console.log('READY: live notebook must show S/0.01 owed without reopening the screen.');
  }
  else if (mode === 'settle-cent') {
    assert.ok(scenario.liveExpenseId, 'Seed add-cent first');
    await call('/pagos/recibido', scenario.receiverId, 'POST', { grupoId: scenario.groupId, pagadorId: scenario.viewerId, monto: 1, metodo: 'efectivo', fechaEfectiva: '2026-10-14' }, 201);
    assert.equal((await call(`/grupos/${scenario.groupId}/estado-cuenta`, scenario.viewerId)).totales.saldo, 0);
    console.log('PASS: live notebook should return to settled without reopening the screen.');
  }
  else if (mode === 'pending') { await snapshot(scenario, 'pendiente'); console.log('PASS: native voucher attached, pending debt unchanged, private image, dated PDF/Excel match the notebook.'); }
  else if (mode === 'confirm') {
    const p = await db.pago.findFirstOrThrow({ where: { grupoId: scenario.groupId, pagadorId: scenario.viewerId } });
    await call(`/pagos/${p.id}/confirmar`, scenario.receiverId, 'POST', {});
    await call(`/pagos/${p.id}/confirmar`, scenario.receiverId, 'POST', {}, 400);
    await snapshot(scenario, 'confirmado');
    console.log('PASS: receiver confirmation settles S/25 exactly once; notebook, dates, PDF and Excel agree.');
  } else throw new Error('Use seed, pending, confirm, add-cent or settle-cent.');
}
run().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => db.$disconnect());
