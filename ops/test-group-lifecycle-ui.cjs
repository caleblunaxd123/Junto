const assert = require('node:assert/strict');
const { test } = require('node:test');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { canAddExpenses, groupStateDescription, groupStateLabel } = require('../apps/mobile/src/lib/groupLifecycle.ts');
const { historyChangeLines, historyStatus } = require('../apps/mobile/src/lib/groupHistory.ts');
const { personalInvite } = require('../apps/mobile/src/lib/members.ts');
test('lifecycle copy distinguishes open, settlement and closed; historic groups stay compatible', () => {
  assert.equal(canAddExpenses({ id: 'old' }), true);
  assert.equal(canAddExpenses({ estado: 'por_liquidar' }), false);
  assert.equal(canAddExpenses({ estado: 'cerrado' }), false);
  assert.equal(groupStateLabel({ estado: 'por_liquidar' }), 'Por liquidar');
  assert.match(groupStateDescription({ estado: 'por_liquidar' }), /confirmar pagos/);
  assert.match(groupStateDescription({ estado: 'cerrado' }), /cuentas finales/);
});
test('correction details show exact amounts, payer, and allocation changes without exposing IDs', () => {
  const rows = historyChangeLines({ antes: { montoTotal: 10000, pagadoPor: 'a', participantes: [{ usuarioId: 'a', montoAsignado: 5000 }, { usuarioId: 'b', montoAsignado: 5000 }] }, despues: { montoTotal: 12000, pagadoPor: 'b', participantes: [{ usuarioId: 'a', montoAsignado: 6000 }, { usuarioId: 'b', montoAsignado: 6000 }] } }, 'PEN', new Map([['a', 'Ana'], ['b', 'Luis']]));
  assert.equal(rows.length, 4); assert.match(rows.join('\n'), /100\.00.*120\.00/); assert.match(rows.join('\n'), /Ana.*Luis/); assert.match(rows.join('\n'), /50\.00.*60\.00/);
  assert.deepEqual(historyChangeLines(null, 'PEN', new Map()), []);
  assert.match(historyStatus({ tipo: 'pago', estado: 'reportado' }), /aún no cuenta/);
  assert.match(historyStatus({ tipo: 'pago', estado: 'rechazado' }), /no cuenta/);
});
test('settling groups can share debts for name-only people without an invalid invitation', () => {
  const group = { nombre: 'Viaje', estado: 'por_liquidar', moneda: 'PEN', resumen: { saldos: [{ deudorId: 'a', acreedorId: 'b', monto: 500, acreedorNombre: 'Luis' }] } };
  const member = { usuarioId: 'a', codigoPersonal: 'invalid-old-code', usuario: { nombre: 'Ana' } };
  const message = personalInvite(group, member, 'Sofía');
  assert.match(message.body, /5\.00/); assert.doesNotMatch(message.body, /invalid-old-code|únete/);
});
