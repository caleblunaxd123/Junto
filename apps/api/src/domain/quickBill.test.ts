import test from "node:test";
import assert from "node:assert/strict";
import { calculateQuickBill, quickBillMessage, quickBillProgress, quickBillBrief, QuickBillInput } from "@junto/shared/quickBill";
import { receiptTotals } from "./receipt";
const birthday: QuickBillInput = { nombre: "Cumpleaños de Jaime", cobrarA: "Organizadora", instrucciones: "Pueden yapear a mi número.", extras: 0, participantes: ["Jaime", "Davetsy", "Gerson", "Caleb", "Sandra", "Lili"].map((nombre, index) => ({ id: `p${index}`, nombre, consumo: 3000, invitado: index === 0 })) };
test("birthday: six plates of 30, Jaime invited, five exact contributions of 36", () => {
  const bill = calculateQuickBill(birthday);
  assert.equal(bill.montoTotal, 18000);
  assert.equal(bill.totalInvitados, 3000);
  assert.deepEqual(bill.partes.map((p) => p.total), [0, 3600, 3600, 3600, 3600, 3600]);
  assert.deepEqual(bill.partes.map((p) => p.invitados), [0, 600, 600, 600, 600, 600]);
  const message = quickBillMessage(birthday);
  assert.match(message, /Jaime: invitado\/a · no paga/);
  assert.match(message, /Caleb: S\/ 36\.00/);
  assert.match(message, /no cobra ni transfiere dinero/);
});
test("receipt equal split needs no dish entry and excludes invited people", () => {
  const result = calculateQuickBill({ ...birthday, division: "igual", totalCuenta: 18000, participantes: birthday.participantes.map((p) => ({ ...p, consumo: 0 })) });
  assert.deepEqual(result.partes.map((p) => p.total), [0, 3600, 3600, 3600, 3600, 3600]);
});
test("partial contributions are cumulative, bounded, and do not change anyone's share", () => {
  const progress = quickBillProgress(birthday, { p1: 1000 });
  assert.equal(progress.cobrado, 1000); assert.equal(progress.pendiente, 17000); assert.equal(progress.estado, "parcial");
  assert.deepEqual(progress.recibidos, []);
  assert.equal(quickBillProgress(birthday, { p1: 2500 }).cobrado, 2500);
  assert.throws(() => quickBillProgress(birthday, { p1: 3601 }), /aporte/);
  assert.throws(() => quickBillProgress(birthday, { p0: 1 }), /aporte/);
  assert.throws(() => quickBillProgress(birthday, { outsider: 1 }), /pertenece/);
  assert.throws(() => quickBillProgress(birthday, { p1: 1.5 }), /aporte/);
  assert.throws(() => calculateQuickBill({ ...birthday, participantes: [{ ...birthday.participantes[1], id: "__proto__" }] }), /Identificador/);
  assert.deepEqual(calculateQuickBill(birthday).partes.map((p) => p.total), [0, 3600, 3600, 3600, 3600, 3600]);
});
test("legacy confirmations survive and brief export explains partial or complete amounts", () => {
  assert.equal(quickBillProgress(birthday, {}, ["p1"]).cobrado, 3600);
  assert.equal(quickBillProgress(birthday, { p1: 0 }, ["p1"]).cobrado, 0);
  assert.match(quickBillBrief(birthday, { p1: 1000 }), /confirmado S\/ 10.00, falta S\/ 26.00/);
  const all = Object.fromEntries(calculateQuickBill(birthday).partes.filter((p) => p.total).map((p) => [p.id, p.total]));
  assert.equal(quickBillProgress(birthday, all).estado, "completada");
});
test("different consumptions, multiple invitees and extras preserve every cent", () => {
  const result = calculateQuickBill({ ...birthday, extras: 101, participantes: [{ id: "a", nombre: "Ana", consumo: 1000, invitado: false }, { id: "b", nombre: "Beto", consumo: 2000, invitado: false }, { id: "c", nombre: "Caro", consumo: 3000, invitado: true }, { id: "d", nombre: "Dani", consumo: 1, invitado: true }] });
  assert.equal(result.montoTotal, 6102);
  assert.equal(result.partes.reduce((sum, p) => sum + p.total, 0), 6102);
  assert.deepEqual(result.partes.map((p) => p.total), [2552, 3550, 0, 0]);
});
test("all invited, duplicate names and malformed consumptions are rejected", () => {
  assert.throws(() => calculateQuickBill({ ...birthday, participantes: birthday.participantes.map((p) => ({ ...p, invitado: true })) }), /debe aportar/);
  assert.throws(() => calculateQuickBill({ ...birthday, participantes: birthday.participantes.map((p) => ({ ...p, nombre: "Jaime" })) }), /nombre distinto/);
  assert.throws(() => calculateQuickBill({ ...birthday, extras: -1 }), /negativos/);
});
test("OCR proposes explicit TOTAL, never subtotal, IGV or the RUC", () => {
  const result = receiptTotals("RUC 20123456789\nSUBTOTAL S/ 152.54\nIGV 27.46\nIMPORTE TOTAL S/ 180.00\nEFECTIVO 200.00\nVUELTO 20.00");
  assert.equal(result.totalPropuesto, 18000);
  assert.equal(result.necesitaRevision, true);
  assert.equal(receiptTotals("SUB TOTAL 152.54\nTOTAL IGV 27.46\nTOTAL ITEMS 6").totalPropuesto, null);
  assert.equal(receiptTotals("TOTAL\nS/ 180,00").totalPropuesto, 18000);
});
test("OCR refuses to choose between different totals or infer an unknown total", () => {
  assert.equal(receiptTotals("TOTAL 180.00\nTOTAL A PAGAR 200.00").totalPropuesto, null);
  assert.equal(receiptTotals("RUC 20123456789\nPAGO 200.00").totalPropuesto, null);
  assert.equal(receiptTotals("TOTAL USD 180.00").totalPropuesto, null);
  assert.equal(receiptTotals("TOTAL 1820").totalPropuesto, null, "Bare OCR integers must not silently autofill a potentially misread amount");
  assert.equal(receiptTotals("TOTAL 1,234.56").totalPropuesto, 123456);
});
