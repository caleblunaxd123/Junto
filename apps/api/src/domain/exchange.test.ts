import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRateReader, referenceForDate, validPaymentDate } from './exchange';
import { readPaymentVoucher } from './voucher';

test('real payment date: exact dates only, no future or impossible day', () => {
  const now = new Date('2026-10-11T12:00:00Z');
  assert.equal(validPaymentDate('2026-10-09', now), true);
  for (const date of ['2026-10-12', '2026-02-30', '2026-99-01', '09/10/2026', '1999-01-01']) assert.equal(validPaymentDate(date, now), false);
  assert.equal(referenceForDate('2026-10-09', '2026-10-11'), true);
  for (const date of ['2026-10-12', '2026-10-01', 'not-a-date', '2026-99-01']) assert.equal(referenceForDate(date, '2026-10-11'), false);
});
test('daily reference accepts a last published date, rounds visibly, and sends only currencies/date', async () => {
  let url = '';
  const read = createRateReader((async (input) => {
    url = String(input); return { ok: true, json: async () => ({ base: 'USD', quote: 'COP', date: '2026-10-09', rate: 3218.1234567 }) };
  }) as typeof fetch);
  const result = await read('USD', 'COP', '2026-10-11');
  assert.equal(result.tasa, '3218.123457'); assert.equal(result.fecha, '2026-10-09');
  assert.equal(url, 'https://api.frankfurter.dev/v2/rate/usd/cop?date=2026-10-11');
});
test('provider failure, stale, wrong pair, future and invalid rates never become payment rates', async () => {
  for (const data of [
    { date: '2026-10-01', base: 'USD', quote: 'COP', rate: 4000 },
    { date: '2026-10-12', base: 'USD', quote: 'COP', rate: 4000 },
    { date: '2026-10-09', base: 'USD', quote: 'PEN', rate: 4 },
    { date: '2026-10-09', base: 'USD', quote: 'COP', rate: 0 },
    { date: '2026-10-09', base: 'USD', quote: 'COP', rate: '4000' },
  ]) {
    const read = createRateReader((async () => ({ ok: true, json: async () => data })) as unknown as typeof fetch);
    await assert.rejects(read('USD', 'COP', '2026-10-11'));
  }
  await assert.rejects(createRateReader((async () => { throw new Error('Timeout'); }) as typeof fetch)('USD', 'COP', '2026-10-11'));
});
test('vouchers propose explicit currencies, ignore fees, and never guess a bare dollar sign', () => {
  for (const [text, code, amount] of [['USD 1.25', 'USD', 125], ['COP 5.000', 'COP', 500000], ['EUR 12,50', 'EUR', 1250], ['MXN 120.00', 'MXN', 12000], ['R$ 32,20', 'BRL', 3220], ['S/ 36.00', 'PEN', 3600]] as const) {
    const reading = readPaymentVoucher(`Transferencia\n${text}\nPara: Ana López\nComisión USD 0.10`);
    assert.equal(reading.moneda, code, text); assert.equal(reading.monto, amount, text); assert.equal(reading.destinatario, 'Ana López');
  }
  assert.equal(readPaymentVoucher('$ 100.00').monto, null);
  assert.equal(readPaymentVoucher('USD 1.25\nCOP 5000').monto, null);
  assert.equal(readPaymentVoucher('USD 1.25\nUSD 2.50').monto, null);
});
