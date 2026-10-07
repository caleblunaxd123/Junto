import test from "node:test";
import assert from "node:assert/strict";
import { matchRecipient, readVoucher, voucherCents } from "./voucher";

// Fictitious vouchers written the way OCR returns them (names, numbers and codes are invented).
const today = new Date("2026-10-07T18:00:00Z");
const yape = `¡Yapeaste!
S/ 25
Ana M. Torres
07 oct. 2026 | 08:15 p. m.
CÓDIGO DE SEGURIDAD
4 8 2
Datos de la transacción
Nro. de celular *** *** 789
Destino Yape
Nro. de operación 03416872`;
const plinInterbank = `¡Plineaste!
S/ 30.00
Para
Luis Ramírez
Fecha y hora
07/10/2026 14:22
Código de operación
123456`;
const plinBbva = `Operación exitosa
Enviaste
S/ 18.50
a María López
con Plin
Fecha 06 Oct 2026, 10:21
Número de operación: 00987654
Comisión S/ 0.00`;

test("Yape: amount, recipient, date, security code and operation", () => {
  const read = readVoucher(yape, today);
  assert.equal(read.app, "yape");
  assert.equal(read.monto, 2500);
  assert.equal(read.destinatario, "Ana M. Torres");
  assert.equal(read.fecha, "2026-10-07");
  assert.equal(read.codigoSeguridad, "482");
  assert.equal(read.operacion, "03416872");
  assert.equal(read.moneda, "PEN");
  assert.deepEqual(read.advertencias, []);
});

test("Plin from a bank app: labelled recipient on the next line, numeric date", () => {
  const read = readVoucher(plinInterbank, today);
  assert.equal(read.app, "plin");
  assert.equal(read.monto, 3000);
  assert.equal(read.destinatario, "Luis Ramírez");
  assert.equal(read.fecha, "2026-10-07");
  assert.equal(read.operacion, "123456");
  assert.equal(read.codigoSeguridad, null);
});

test("Plin sentence style: 'a María López', fees are not the payment", () => {
  const read = readVoucher(plinBbva, today);
  assert.equal(read.app, "plin");
  assert.equal(read.monto, 1850);
  assert.deepEqual(read.candidatos, [1850]);
  assert.equal(read.destinatario, "María López");
  assert.equal(read.fecha, "2026-10-06");
  assert.equal(read.operacion, "00987654");
});

test("OCR misreads and separated 'S/' still give the exact cents", () => {
  assert.equal(readVoucher("¡Yapeaste!\n5/ 12.5\nJosé Pérez", today).monto, 1250);
  const split = readVoucher("¡Yapeaste!\nS/\n1,250.00\nCarla Díaz", today);
  assert.equal(split.monto, 125000);
  assert.equal(split.destinatario, "Carla Díaz");
  assert.equal(readVoucher("Yape\nS/.40,90", today).monto, 4090);
  assert.equal(voucherCents("1.250,00"), 125000);
  assert.equal(voucherCents("0"), null);
  assert.equal(voucherCents("12a"), null);
});

test("dates are never read as money; impossible dates are ignored", () => {
  const read = readVoucher("Plin\nFecha 5/10/2026\nS/ 20.00\n31/02/2026", today);
  assert.deepEqual(read.candidatos, [2000]);
  assert.equal(read.fecha, "2026-10-05");
});

test("ambiguous, missing or foreign amounts are not proposed", () => {
  const two = readVoucher("Yape\nS/ 20.00\nS/ 25.00", today);
  assert.equal(two.monto, null);
  assert.deepEqual(two.candidatos, [2000, 2500]);
  assert.match(two.advertencias.join(" "), /más de un monto/);
  const none = readVoucher("Una foto cualquiera\nsin montos", today);
  assert.equal(none.monto, null);
  assert.equal(none.app, null);
  assert.match(none.advertencias.join(" "), /No pudimos leer el monto/);
  const usd = readVoucher("Transferencia\nUS$ 50.00\nS/ 50.00", today);
  assert.equal(usd.monto, null);
  assert.equal(usd.moneda, "USD");
  assert.match(usd.advertencias.join(" "), /dólares/);
});

test("old or future vouchers are flagged for review", () => {
  assert.match(readVoucher("Yape\nS/ 10\n01/07/2026", today).advertencias.join(" "), /hace 98 días/);
  assert.match(readVoucher("Yape\nS/ 10\n20/10/2026", today).advertencias.join(" "), /posterior a hoy/);
});

test("labels and surnames that contain label words", () => {
  assert.equal(readVoucher("¡Yapeaste!\nS/ 15\nAna Montoya", today).destinatario, "Ana Montoya");
  assert.equal(readVoucher("¡Yapeaste!\nS/ 15\nDestino Yape", today).destinatario, null);
  // Yape sending to a Plin user is still a Yape voucher.
  assert.equal(readVoucher("¡Yapeaste!\nDestino Plin\nS/ 15", today).app, "yape");
  assert.equal(readVoucher("Constancia de transferencia\nS/ 15.00", today).app, "transferencia");
});

test("recipient matching suggests only an unambiguous member", () => {
  const people = [
    { id: "ana", nombre: "Ana María Torres Vega" },
    { id: "ana2", nombre: "Ana Rojas" },
    { id: "luis", nombre: "Luis Ramírez" },
    { id: "marta", nombre: "Marta" },
  ];
  assert.equal(matchRecipient("Ana M. Torres", people), "ana");
  assert.equal(matchRecipient("Luis Ramirez", people), "luis");
  assert.equal(matchRecipient("ANA", people), null, "two Anas: no guess");
  assert.equal(matchRecipient("Pedro Castillo", people), null);
  assert.equal(matchRecipient(null, people), null);
  // An initial alone never decides: "M." must not point to Marta.
  assert.equal(matchRecipient("Ana M. Torres", [{ id: "ana", nombre: "Ana" }, { id: "marta", nombre: "Marta" }]), "ana");
});
