import test from "node:test";
import assert from "node:assert/strict";
import { receiptTotals } from "./receipt";
import { receiptWordsCents } from "./spanishMoney";

// Fictitious receipts written the way OCR returns them from phone photos (businesses are invented).

test('a typical Peruvian boleta proposes IMPORTE TOTAL, not the taxable base, cash or change', () => {
  const result = receiptTotals('POLLERIA QA SAC\nBOLETA B001-00045821\n1/4 POLLO 24.90\nOP. GRAVADA S/ 35.93\nI.G.V. 18% S/ 6.47\nIMPORTE TOTAL S/ 42.40\nEFECTIVO S/ 50.00\nVUELTO S/ 7.60');
  assert.equal(result.totalPropuesto, 4240);
  assert.deepEqual(result.candidatos.map((c) => c.monto), [4240]);
  assert.match(result.advertencia, /coincide con las cuentas/);
});

test('OCR reading "S/" as "5/" or "S/." still gives one amount', () => {
  assert.equal(receiptTotals('BOLETA 001\nTOTAL 5/ 27.40').totalPropuesto, 2740);
  assert.equal(receiptTotals('Boleta B003\nTotal S/. 20.50').totalPropuesto, 2050);
});

test('a blurred last decimal is proposed only when the receipt confirms it', () => {
  const confirmed = receiptTotals('BOLETA B002\nOP. GRAVADA 5/ 67.8\nI.G.V. S/ 12.2\nIMPORTE TOTAL S/ 80.0\nEFECTIVO / 100.0');
  assert.equal(confirmed.totalPropuesto, 8000);
  const alone = receiptTotals('BOLETA B002\nIMPORTE TOTAL S/ 80.0');
  assert.equal(alone.totalPropuesto, null);
  assert.deepEqual(alone.candidatos.map((c) => c.monto), [8000]);
  // Misread last decimal: the receipt's own sum is offered next to it, nothing is chosen.
  const misread = receiptTotals('OP. GRAVADA S/ 67.80\nI.G.V. S/ 12.20\nIMPORTE TOTAL S/ 80.1');
  assert.equal(misread.totalPropuesto, null);
  assert.deepEqual(misread.candidatos.map((c) => c.monto), [8010, 8000]);
});

test('the same digits read twice ("2050." and "20.50") are one candidate', () => {
  const result = receiptTotals('Total S/. 2050.\nTotal S/. 20.50');
  assert.equal(result.totalPropuesto, 2050);
  assert.equal(result.candidatos.length, 1);
});

test('two different totals are listed, TOTAL A PAGAR first, unless the receipt settles it', () => {
  const open = receiptTotals('TOTAL DESCUENTOS S/ 2.00\nTOTAL ITEMS 3\nTOTAL S/ 61.10\nTOTAL A PAGAR S/ 59.10');
  assert.equal(open.totalPropuesto, null);
  assert.deepEqual(open.candidatos.map((c) => c.monto), [5910, 6110]);
  assert.equal(receiptTotals('TOTAL S/ 61.10\nOP. GRAVADA S/ 50.08\nIGV S/ 9.02\nTOTAL A PAGAR S/ 59.10').totalPropuesto, 5910);
});

test('the amount in words confirms or supplies the total', () => {
  assert.equal(receiptWordsCents('SON: CUARENTA Y DOS CON 40/100 SOLES'), 4240);
  assert.equal(receiptWordsCents('SON: MIL DOSCIENTOS CON 00/100 SOLES'), 120000);
  const fromWords = receiptTotals('BOLETA B001\nARROZ 10.00\nSON: CUARENTA Y DOS CON 40/100 SOLES');
  assert.equal(fromWords.totalPropuesto, 4240);
});

test('without a total line the base + IGV sum is offered, never chosen alone', () => {
  const result = receiptTotals('BOLETA B001\nOP. GRAVADA S/ 35.93\nIGV S/ 6.47');
  assert.equal(result.totalPropuesto, null);
  assert.deepEqual(result.candidatos.map((c) => c.monto), [4240]);
});

test('thousands separators and other currencies keep working', () => {
  assert.equal(receiptTotals('FACTURA F001\nOP. GRAVADA 2,545.08\nIGV 18% 456.92\nTOTAL S/ 3,002.00').totalPropuesto, 300200);
  assert.equal(receiptTotals('TOTAL USD 20.00').totalPropuesto, null);
});
