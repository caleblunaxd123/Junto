import test from 'node:test';
import assert from 'node:assert/strict';
import { currencyTotals } from './currencyTotals';

test('account deletion keeps soles, dollars and zero-net obligations distinct', () => {
  assert.deepEqual(currencyTotals([
    { moneda: 'USD', debes: 10000, teDeben: 0 },
    { moneda: 'PEN', debes: 3000, teDeben: 3000 },
    { moneda: 'USD', debes: 500, teDeben: 700 },
  ]), [
    { moneda: 'PEN', debes: 3000, teDeben: 3000 },
    { moneda: 'USD', debes: 10500, teDeben: 700 },
  ]);
  assert.deepEqual(currencyTotals([]), []);
});
