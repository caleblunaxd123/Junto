import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccounts } from './accounts';
const members = [{ id: 'caleb', nombre: 'Caleb' }, { id: 'ana', nombre: 'Ana' }, { id: 'luis', nombre: 'Luis' }];
const expenses = [
  { montoTotal: 12000, pagadoPor: 'caleb', participantes: members.map((m) => ({ usuarioId: m.id, montoAsignado: 4000 })) },
  { montoTotal: 6000, pagadoPor: 'ana', participantes: members.map((m) => ({ usuarioId: m.id, montoAsignado: 2000 })) },
];
test('Cusco: two expenses produce exact accounts and settlement', () => {
  const result = calculateAccounts(members, expenses, []);
  assert.equal(result.totalGastado, 18000);
  assert.deepEqual(result.cuentas.map((m) => m.neto), [6000, 0, -6000]);
  assert.deepEqual(result.saldos, [{ deudorId: 'luis', deudorNombre: 'Luis', acreedorId: 'caleb', acreedorNombre: 'Caleb', monto: 6000 }]);
});
test('pending payment preserves debt; confirmed payment settles it', () => {
  const pending = { pagadorId: 'luis', receptorId: 'caleb', monto: 6000, estado: 'reportado' };
  assert.deepEqual(calculateAccounts(members, expenses, [pending]).cuentas.map((m) => m.neto), [6000, 0, -6000]);
  assert.deepEqual(calculateAccounts(members, expenses, [{ ...pending, estado: 'exitoso' }]).cuentas.map((m) => m.neto), [0, 0, 0]);
});
