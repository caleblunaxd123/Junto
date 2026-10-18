import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateAccounts } from './accounts';
import { expensePayers, validatePayers } from './expensePayers';
import { buildStatement } from './statement';

const members = ['a', 'b', 'c', 'd', 'e'].map(id => ({ id, nombre: id }));
const expense = { montoTotal: 50000, pagadoPor: 'a', pagadores: [{ usuarioId: 'a', monto: 20000 }, { usuarioId: 'b', monto: 20000 }, { usuarioId: 'c', monto: 10000 }], participantes: members.map(m => ({ usuarioId: m.id, montoAsignado: 10000 })) };

test('three of five advanced money: only the uncovered shares are owed, never the gross total', () => {
  assert.deepEqual(validatePayers(expense), expense.pagadores);
  const result = calculateAccounts(members, [expense], [], false);
  assert.deepEqual(result.cuentas.map(p => p.pagaste), [20000, 20000, 10000, 0, 0]);
  assert.deepEqual(result.cuentas.map(p => p.neto), [10000, 10000, 0, -10000, -10000]);
  assert.equal(result.saldos.reduce((sum, d) => sum + d.monto, 0), 20000);
  assert.equal(result.totalGastado, 50000);
  assert.ok(result.saldos.every(d => ['d', 'e'].includes(d.deudorId) && ['a', 'b'].includes(d.acreedorId)));
  const ordered = { ...expense, pagadores: [...expense.pagadores].reverse(), participantes: [...expense.participantes].reverse() };
  assert.deepEqual(calculateAccounts(members, [ordered], [], false).saldos, result.saldos);
});

test('bad advances are rejected: missing cents, excess, duplicates, zero, decimals and wrong primary', () => {
  for (const pagadores of [[], [{ usuarioId: 'a', monto: 49999 }], [{ usuarioId: 'a', monto: 50001 }], [{ usuarioId: 'a', monto: 25000 }, { usuarioId: 'a', monto: 25000 }], [{ usuarioId: 'a', monto: 50000 }, { usuarioId: 'b', monto: 0 }], [{ usuarioId: 'a', monto: 49999.5 }, { usuarioId: 'b', monto: 0.5 }], [{ usuarioId: 'b', monto: 50000 }]])
    assert.throws(() => validatePayers({ ...expense, pagadores }));
});

test('legacy expenses, single explicit payer and odd cents keep identical accounts', () => {
  const legacy = { montoTotal: 1001, pagadoPor: 'a', participantes: [{ usuarioId: 'a', montoAsignado: 501 }, { usuarioId: 'b', montoAsignado: 500 }] };
  assert.deepEqual(expensePayers(legacy), [{ usuarioId: 'a', monto: 1001 }]);
  assert.deepEqual(calculateAccounts(members, [legacy], [], false), calculateAccounts(members, [{ ...legacy, pagadores: expensePayers(legacy) }], [], false));
});

test('statements agree for all payers; reported payments never discount balances', () => {
  const first = calculateAccounts(members, [expense], [], false).saldos[0];
  const payment = { pagadorId: first.deudorId, receptorId: first.acreedorId, monto: 501, estado: 'reportado' };
  const pending = calculateAccounts(members, [expense], [payment], false);
  const confirmed = calculateAccounts(members, [expense], [{ ...payment, estado: 'exitoso' }], false);
  assert.deepEqual(pending.cuentas.map(p => p.neto), [10000, 10000, 0, -10000, -10000]);
  for (const person of members) {
    const statement = buildStatement(person.id, [{ ...expense, id: 'g', descripcion: 'Cena', categoria: 'comida', fecha: new Date('2026-10-17'), fechaRegistro: new Date('2026-10-17'), pagadorNombre: 'a, b, c' }], []);
    assert.equal(statement.totales.saldo, pending.cuentas.find(p => p.usuarioId === person.id)!.neto);
    assert.equal(statement.totales.pagasteEnGastos, pending.cuentas.find(p => p.usuarioId === person.id)!.pagaste);
  }
  assert.equal(confirmed.cuentas.reduce((sum, p) => sum + p.neto, 0), 0);
  assert.equal(confirmed.saldos.reduce((sum, p) => sum + p.monto, 0), 20000 - 501);
});

test('deterministic varied multi-payer splits settle every cent in either group mode', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const amounts = [seed * 101, seed * 7 + 1, seed * 13 + 3];
    const total = amounts.reduce((sum, n) => sum + n, 0);
    const e = { montoTotal: total, pagadoPor: 'a', pagadores: amounts.map((monto, i) => ({ usuarioId: members[i].id, monto })), participantes: members.map((m, i) => ({ usuarioId: m.id, montoAsignado: Math.floor(total / 5) + (i < total % 5 ? 1 : 0) })) };
    for (const simplify of [true, false]) {
      const result = calculateAccounts(members, [e], [], simplify);
      assert.equal(result.cuentas.reduce((sum, p) => sum + p.neto, 0), 0);
      for (const p of result.cuentas) assert.equal(result.saldos.reduce((sum, d) => sum + (d.acreedorId === p.usuarioId ? d.monto : 0) - (d.deudorId === p.usuarioId ? d.monto : 0), 0), p.neto);
    }
  }
});
