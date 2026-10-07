import test from "node:test";
import assert from "node:assert/strict";
import { quickBillReadSchema, quickBillWriteSchema } from "../schemas/quickBill.schema";
import { calculateQuickBill } from "@junto/shared/quickBill";
import { allocateEqual, allocatePercentages } from "./money";
import { registerSchema } from "../schemas/auth.schema";
import { reportarPagoSchema } from "../schemas/pagos.schema";
import { editarGastoSchema } from "../schemas/gastos.schema";
const receipt = { nombre: "Reparto QA", cobrarA: "", instrucciones: "", division: "consumos" as const, totalCuenta: 50000, extras: 0, participantes: [10000, 5000, 15000, 7000, 1000].map((consumo, i) => ({ id: `p${i}`, nombre: `Persona ${i + 1}`, consumo, invitado: false })) };
test("receipt 500 vs consumption 380 is rejected in shared server calculation", () => {
  assert.throws(() => calculateQuickBill(quickBillWriteSchema.parse(receipt)), /Faltan S\/ 120.00/);
  assert.throws(() => calculateQuickBill({ ...receipt, totalCuenta: 37999 }), /Sobran S\/ 0.01/);
  assert.throws(() => calculateQuickBill({ ...receipt, extras: 12000 }), /Faltan S\/ 120.00/);
  assert.equal(calculateQuickBill({ ...receipt, totalCuenta: 38000 }).montoTotal, 38000);
});
test("new writes require a receipt total, old records remain readable", () => {
  const { totalCuenta, ...legacy } = receipt;
  assert.equal(totalCuenta, 50000);
  assert.equal(quickBillWriteSchema.safeParse(legacy).success, false);
  assert.equal(calculateQuickBill(quickBillReadSchema.parse(legacy)).montoTotal, 38000);
  assert.equal(quickBillWriteSchema.safeParse({ ...receipt, totalCuenta: 0 }).success, false);
});
test("unsafe numbers, NaN extras, invalid modes and normalized duplicate names are rejected", () => {
  assert.throws(() => calculateQuickBill({ ...receipt, totalCuenta: 38000, extras: NaN }));
  assert.throws(() => calculateQuickBill({ ...receipt, division: "unknown" as "consumos" }));
  assert.throws(() => calculateQuickBill({ ...receipt, participantes: [{ ...receipt.participantes[0], consumo: Number.MAX_SAFE_INTEGER + 1 }] }));
  assert.throws(() => calculateQuickBill({ ...receipt, participantes: [{ ...receipt.participantes[0], nombre: "Ana Pérez" }, { ...receipt.participantes[1], nombre: " ana  pérez " }] }), /nombre distinto/);
  assert.throws(() => allocateEqual(Number.MAX_SAFE_INTEGER + 1, ["p0"]));
});
test("percentages bounded and at most two decimal places on server", () => {
  for (const porcentaje of [NaN, Infinity, -1, 100.01, 33.333]) assert.throws(() => allocatePercentages(10000, [{ usuarioId: "a", porcentaje }, { usuarioId: "b", porcentaje: 100 - porcentaje }]));
  assert.equal(allocatePercentages(10001, [{ usuarioId: "a", porcentaje: 33.33 }, { usuarioId: "b", porcentaje: 66.67 }]).reduce((sum, p) => sum + p.montoAsignado, 0), 10001);
});
test("registration rejects blank names, payments are bounded, empty expense updates rejected", () => {
  assert.equal(registerSchema.safeParse({ nombre: "   ", email: "qa@example.invalid", password: "password1" }).success, false);
  assert.equal(reportarPagoSchema.safeParse({ receptorId: "00000000-0000-4000-8000-000000000001", grupoId: "00000000-0000-4000-8000-000000000002", monto: 1_000_000_000, metodo: "yape" }).success, false);
  assert.equal(editarGastoSchema.safeParse({}).success, false);
});
