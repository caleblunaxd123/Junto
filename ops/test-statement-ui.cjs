const assert = require('node:assert/strict');
const { test } = require('node:test');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { describe, dayLabel, registeredLabel, settlementLines, statementText } = require('../apps/mobile/src/lib/statement.ts');
const { formatMoney } = require('../packages/shared/currency.js');
const { statementRequestError } = require('../apps/mobile/src/lib/statementExportError.ts');
const { groupAccountExplanation } = require('../apps/mobile/src/lib/accountSummary.ts');
const money = v => formatMoney(v, 'PEN');
const row = { tipo: 'pago', id: 'p', fecha: '2025-12-31', fechaRegistro: '2026-01-02T01:00:00Z', sentido: 'enviado', contraparteNombre: 'Ana Torres', monto: 3000, efecto: 0, saldo: 0, metodo: 'yape', estado: 'reportado', conComprobante: true };
test('a pending or rejected voucher does not claim that money arrived', () => {
  assert.equal(describe(row, money).title, 'Pago a Ana Torres');
  assert.match(describe(row, money).detail, /por confirmar, aún no cuenta.*con comprobante/);
  assert.match(describe({ ...row, estado: 'rechazado' }, money).detail, /rechazado, no cuenta/);
  assert.equal(describe({ ...row, estado: 'exitoso' }, money).title, 'Le pagaste a Ana Torres');
});
test('calendar dates keep their year and do not shift a day in Peru', () => {
  const before = process.env.TZ;
  try {
    process.env.TZ = 'America/Lima';
    assert.match(dayLabel(row.fecha), /31.*2025/);
    assert.match(dayLabel(row.fechaRegistro), /1.*2026/);
    assert.match(registeredLabel(row), /Anotado el/);
  } finally { if (before === undefined) delete process.env.TZ; else process.env.TZ = before; }
});
test('copy/share preserve both debts even with net zero; personal spending excludes transfers', () => {
  const s = { grupo: { nombre: 'Cuaderno QA', moneda: 'PEN' }, movimientos: [row], totales: { tuParte: 1000, pagasteEnGastos: 1000, pagosEnviados: 0, pagosRecibidos: 0, saldo: 0 }, porCategoria: [{ categoria: 'comida', monto: 1000 }], balance: { teDeben: 3000, debes: 3000 }, saldos: [{ acreedorId: 'yo', deudorId: 'a', deudorNombre: 'Ana Torres', monto: 3000 }, { deudorId: 'yo', acreedorId: 'b', acreedorNombre: 'Luis Pérez', monto: 3000 }] };
  const text = statementText(s, settlementLines(s, 'yo'));
  assert.match(text, /Ana Torres te debe S\/ 30\.00/);
  assert.match(text, /Le debes S\/ 30\.00 a Luis Pérez/);
  assert.match(text, /Saldo neto: neto cero/);
  assert.doesNotMatch(text, /Estoy a mano/);
  assert.match(text, /Comida: S\/ 10\.00/);
  assert.match(text, /2025/);
  assert.match(text, /por confirmar, aún no cuenta/);
});

test('changed exports require a fresh review; unrelated errors never expose server or device details', () => {
  const changed = statementRequestError({ response: { status: 409 } });
  assert.equal(changed.refresh, true);
  assert.match(changed.message, /revisa los montos/);
  for (const error of [new Error('file:///private/path/secret'), { response: { status: 500, data: { error: 'Prisma SQLSTATE SELECT secrets' } } }]) {
    const failure = statementRequestError(error);
    assert.equal(failure.refresh, false);
    assert.doesNotMatch(failure.message, /secret|Prisma|SQLSTATE|file:\/\//);
  }
  assert.match(statementRequestError({ response: { status: 413 } }).message, /5000/);
  assert.match(statementRequestError({ response: { status: 401 } }).message, /sesión/);
});

test('the group never says you have not paid after a confirmed settlement payment', () => {
  const before = { pagaste: 0, tuParte: 2500, pagosEnviados: 0, pagosRecibidos: 0 };
  assert.match(groupAccountExplanation(before, true, 'PEN'), /No has adelantado gastos/);
  const paid = groupAccountExplanation({ ...before, pagosEnviados: 2500 }, true, 'PEN');
  assert.match(paid, /Tu parte es S\/ 25\.00/);
  assert.match(paid, /Pagaste a otros S\/ 25\.00/);
  assert.doesNotMatch(paid, /No has|nada aún/);
  const partial = groupAccountExplanation({ ...before, pagosEnviados: 1000 }, true, 'PEN');
  assert.match(partial, /parte es S\/ 25\.00.*otros S\/ 10\.00/);
  const receiver = groupAccountExplanation({ pagaste: 20000, tuParte: 7000, pagosEnviados: 0, pagosRecibidos: 3000 }, true, 'PEN');
  assert.match(receiver, /Adelantaste S\/ 200\.00 en gastos.*Te pagaron S\/ 30\.00/);
});
