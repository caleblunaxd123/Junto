const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { calculateAccounts } = require('../apps/api/src/domain/accounts.ts');
const { groupContribution } = require('../apps/mobile/src/lib/groupContribution.ts');
const { groupProgress, freeParts, heldParts } = require('../apps/mobile/src/lib/groupProgress.ts');
const members = ['caleb', 'ana', 'luis', 'marta', 'pedro'].map(id => ({ id, nombre: id }));
const expenses = [{ montoTotal: 50000, pagadoPor: 'caleb', participantes: members.map(m => ({ usuarioId: m.id, montoAsignado: 10000 })) }];
const account = (id, payments = []) => calculateAccounts(members, expenses, payments).cuentas.find(a => a.usuarioId === id);
test('500 between five: organizer covers own 100 and recovers 400, not 500', () => {
  assert.deepEqual(groupContribution(account('caleb')), { parte: 10000, cubierto: 10000, pendiente: 0, porRecuperar: 40000, porConfirmar: 0, progreso: 1 });
  assert.equal(groupContribution(account('ana')).pendiente, 10000);
});
test('a partial reported payment does not cover a share until confirmed', () => {
  const payment = { pagadorId: 'ana', receptorId: 'caleb', monto: 5000, estado: 'reportado' };
  assert.equal(groupContribution(account('ana', [payment])).cubierto, 0);
  assert.equal(groupContribution(account('ana', [payment])).porConfirmar, 5000);
  payment.estado = 'exitoso';
  assert.equal(groupContribution(account('ana', [payment])).cubierto, 5000);
  assert.equal(groupContribution(account('ana', [payment])).pendiente, 5000);
  assert.equal(groupContribution(account('caleb', [payment])).porRecuperar, 35000);
  assert.equal(calculateAccounts(members, expenses, [payment]).totalGastado, 50000);
});
test('rejected payment and new group member never change the original total or split', () => {
  const payment = { pagadorId: 'ana', receptorId: 'caleb', monto: 10000, estado: 'rechazado' };
  assert.equal(groupContribution(account('ana', [payment])).cubierto, 0);
  const summary = calculateAccounts([...members, { id: 'new', nombre: 'New' }], expenses, [payment]);
  assert.equal(summary.totalGastado, 50000);
  assert.equal(summary.cuentas.find(a => a.usuarioId === 'new').tuParte, 0);
  assert.equal(summary.cuentas.find(a => a.usuarioId === 'ana').tuParte, 10000);
});
test('full repayments cover each share without double-counting the organizer advance', () => {
  const payments = members.slice(1).map(m => ({ pagadorId: m.id, receptorId: 'caleb', monto: 10000, estado: 'exitoso' }));
  const summary = calculateAccounts(members, expenses, payments);
  assert.equal(summary.cuentas.reduce((sum, a) => sum + groupContribution(a).cubierto, 0), 50000);
  assert.equal(summary.saldos.length, 0);
  assert.equal(summary.totalGastado, 50000);
});

test('vacant seats preserve cents, including older API responses', () => {
  assert.deepEqual(freeParts({ montoTotal: 10000, partes: 3, libres: 2 }), [3333, 3333]);
  const group = { modo: 'cobranza', cuenta: { montoTotal: 10000, partes: 3, libres: 2, pagadoPor: 'caleb' }, resumen: calculateAccounts([{ id: 'caleb', nombre: 'Caleb' }], [{ montoTotal: 10000, pagadoPor: 'caleb', participantes: [{ usuarioId: 'caleb', montoAsignado: 10000 }] }], []) };
  assert.equal(heldParts(group, 'caleb'), 6666);
  assert.deepEqual(groupProgress(group), { total: 10000, free: 6666, pending: 0, goal: 6666, done: 0, progress: 0 });
});

test('the progress covers every expense and nets refunds instead of summing gross transfers', () => {
  const bills = [
    { montoTotal: 50000, pagadoPor: 'caleb', participantes: members.map(m => ({ usuarioId: m.id, montoAsignado: 10000 })) },
    { montoTotal: 5000, pagadoPor: 'ana', participantes: [{ usuarioId: 'ana', montoAsignado: 2500 }, { usuarioId: 'caleb', montoAsignado: 2500 }] },
  ];
  const confirmed = [{ pagadorId: 'ana', receptorId: 'caleb', monto: 5000, estado: 'exitoso' }];
  const group = { modo: 'cobranza', resumen: calculateAccounts(members, bills, confirmed), cuentasPorPartes: [] };
  assert.deepEqual(groupProgress(group), { total: 55000, free: 0, pending: 32500, goal: 37500, done: 5000, progress: 5000 / 37500 });
  // A reimbursement later offset by a new expense cannot inflate the progress bar.
  const reversed = [...confirmed, { pagadorId: 'caleb', receptorId: 'ana', monto: 5000, estado: 'exitoso' }];
  group.resumen = calculateAccounts(members, bills, reversed);
  assert.equal(groupProgress(group).done, 0);
});
