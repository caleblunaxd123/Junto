import test from 'node:test';
import assert from 'node:assert/strict';
import {
  allocateEqual,
  allocateExact,
  allocatePercentages,
  simplifyNetBalances,
} from './money';

test('equal split preserves every cent', () => {
  const result = allocateEqual(100, ['a', 'b', 'c']);
  assert.deepEqual(result.map((item) => item.montoAsignado), [34, 33, 33]);
  assert.equal(result.reduce((sum, item) => sum + item.montoAsignado, 0), 100);
});

test('percentage split preserves every cent', () => {
  const result = allocatePercentages(100, [
    { usuarioId: 'a', porcentaje: 33.33 },
    { usuarioId: 'b', porcentaje: 33.33 },
    { usuarioId: 'c', porcentaje: 33.34 },
  ]);
  assert.deepEqual(result.map((item) => item.montoAsignado), [33, 33, 34]);
  assert.equal(result.reduce((sum, item) => sum + item.montoAsignado, 0), 100);
});

test('exact split rejects totals that do not match', () => {
  assert.throws(
    () => allocateExact(100, [{ usuarioId: 'a', monto: 99 }]),
    /suman 99 centavos/
  );
});

test('a participant cannot appear twice', () => {
  assert.throws(() => allocateEqual(100, ['a', 'a']), /dos veces/);
});

test('one-cent debt is never discarded', () => {
  const result = simplifyNetBalances(
    [{ id: 'debtor', nombre: 'Ana', monto: 1 }],
    [{ id: 'creditor', nombre: 'Luis', monto: 1 }]
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].monto, 1);
});
