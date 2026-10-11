const assert = require('node:assert/strict');
const { test } = require('node:test');
const { currencies, countries, currencyInfo, formatMoney, convertPayment } = require('../packages/shared/currency');
const { groupShareMessage, expenseShareMessage, shareEmailHtml } = require('../packages/shared/share');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { accountSummary } = require('../apps/mobile/src/lib/accountSummary.ts');

test('country suggests a currency but USD/EUR remain independent choices', () => {
  assert.equal(countries.find((c) => c.code === 'CO').currency, 'COP');
  assert.equal(countries.find((c) => c.code === 'OTHER').currency, null);
  for (const code of ['PEN', 'COP', 'USD', 'EUR', 'MXN', 'BRL']) assert.equal(currencyInfo(code).code, code);
  assert.equal(currencies.length, 6);
  assert.throws(() => currencyInfo('XYZ'));
});
test('amounts retain their original minor units and an unambiguous currency', () => {
  assert.equal(formatMoney(500000, 'COP'), 'COP 5000.00');
  assert.equal(formatMoney(125, 'USD'), 'US$ 1.25');
  assert.equal(formatMoney(-123, 'EUR'), '€ -1.23');
  assert.throws(() => formatMoney(1.5));
  assert.throws(() => formatMoney(NaN));
});
test('agreed conversion uses exact half-up rounding, not float or AI math', () => {
  const input = { monedaOrigen: 'USD', montoOrigen: 125, tipoCambio: '4000' };
  assert.deepEqual(convertPayment(input, 'COP'), { ...input, monto: 500000 });
  assert.equal(convertPayment({ ...input, montoOrigen: 1, tipoCambio: '0.5' }, 'EUR').monto, 1);
  assert.equal(convertPayment({ ...input, montoOrigen: 333, tipoCambio: '3,777777' }, 'PEN').monto, 1258);
  assert.equal(convertPayment({ ...input, montoOrigen: 999999999, tipoCambio: '1' }, 'EUR').monto, 999999999);
  assert.deepEqual(input, { monedaOrigen: 'USD', montoOrigen: 125, tipoCambio: '4000' });
});
test('invalid, ambiguous, zero and overflowing conversions are refused', () => {
  const base = { monedaOrigen: 'USD', montoOrigen: 125, tipoCambio: '4000' };
  for (const tipoCambio of ['', '0', '-2', '1e3', 'Infinity', '1.1234567', '1,000,00', '1000000', 'NaN'])
    assert.throws(() => convertPayment({ ...base, tipoCambio }, 'COP'), tipoCambio);
  for (const montoOrigen of [0, -1, 1.1, NaN, 1000000000]) assert.throws(() => convertPayment({ ...base, montoOrigen }, 'COP'));
  assert.throws(() => convertPayment(base, 'USD'));
  assert.throws(() => convertPayment({ ...base, monedaOrigen: 'XXX' }, 'COP'));
  assert.throws(() => convertPayment({ ...base, tipoCambio: '0.000001', montoOrigen: 1 }, 'COP'));
  assert.throws(() => convertPayment({ ...base, montoOrigen: 999999999 }, 'COP'));
});
test('personal totals never add dollars, pesos and soles together', () => {
  const groups = [
    { id: 'a', moneda: 'COP', balanceUsuario: { teDeben: 500000, debes: 0, neto: 500000 } },
    { id: 'b', moneda: 'USD', balanceUsuario: { teDeben: 0, debes: 125, neto: -125 } },
    { id: 'c', moneda: 'COP', balanceUsuario: { teDeben: 0, debes: 100, neto: -100 } },
  ];
  const summary = accountSummary(groups);
  assert.equal(summary.owed, null); assert.equal(summary.owes, null);
  assert.deepEqual(summary.byCurrency, [{ moneda: 'COP', owed: 500000, owes: 100 }, { moneda: 'USD', owed: 0, owes: 125 }]);
});
test('shared text and HTML retain group/expense currency, including escaped names', () => {
  const group = { nombre: '<script>QA</script>', moneda: 'COP', resumen: { totalGastado: 500000, cantidadGastos: 1, cuentas: [{ nombre: 'QA', tuParte: 500000, pagaste: 0, neto: -500000 }] }, saldos: [] };
  const message = groupShareMessage(group);
  assert.match(message.body, /COP 5000\.00/); assert.doesNotMatch(message.body, /S\//);
  const html = shareEmailHtml(message);
  assert.match(html, /COP 5000\.00/); assert.doesNotMatch(html, /<script>QA<\/script>/);
  const expense = expenseShareMessage({ descripcion: 'QA', montoTotal: 125, pagador: { nombre: 'QA' }, participantes: [{ usuario: { nombre: 'Otro' }, montoAsignado: 125 }] }, 'Viaje', 'USD');
  assert.match(expense.body, /US\$ 1\.25/); assert.equal(expense.preview.moneda, 'USD');
});
