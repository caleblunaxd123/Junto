// The money scenarios JUNTO must always get right, against the same code the app and the API run.
const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { calculateQuickBill, quickBillProgress } = require("../packages/shared/quickBill.js");
const { validateQuickBillDraft } = require("../apps/mobile/src/lib/quickBillValidation.ts");
const { previewTryBill } = require("../apps/mobile/src/lib/tryBill.ts");
const { nextContribution } = require("../apps/mobile/src/lib/contribution.ts");
const { pendingActions } = require("../apps/mobile/src/lib/pending.ts");
const { calculateAccounts } = require("../apps/api/src/domain/accounts.ts");

const person = (id, consumo = 0, invitado = false) => ({ id, nombre: id, consumo, invitado });

test("A · receipt S/ 500 with consumptions of S/ 380: S/ 120 unassigned and saving is blocked", () => {
  const draft = { name: "Cena", recipient: "", instructions: "", billTotal: "500", extras: "0", division: "consumos", scanApproved: true, names: "",
    people: [["Ana", "100"], ["Luis", "80"], ["Rosa", "200"]].map(([nombre, consumo], i) => ({ id: `p${i}`, nombre, consumo, invitado: false })) };
  const check = validateQuickBillDraft(draft);
  assert.equal(check.difference, 12000);
  assert.match(check.stepErrors[1], /Faltan S\/ 120\.00/);
  assert.equal(check.valid, false);
  assert.equal(check.result, undefined, "no preview total is offered for an unbalanced bill");
  // The API rejects the same input even if a client skips the check.
  assert.throws(() => calculateQuickBill({ nombre: "Cena", cobrarA: "", instrucciones: "", extras: 0, division: "consumos", totalCuenta: 50000,
    participantes: [person("a", 10000), person("b", 8000), person("c", 20000)] }), /Faltan S\/ 120\.00/);
});

test("B · S/ 100 among three is 33.34 + 33.33 + 33.33, never 3 × 33.34", () => {
  const result = calculateQuickBill({ nombre: "Cena", cobrarA: "", instrucciones: "", extras: 0, division: "igual", totalCuenta: 10000, participantes: ["a", "b", "c"].map((id) => person(id)) });
  assert.deepEqual(result.partes.map((p) => p.total), [3334, 3333, 3333]);
  assert.equal(result.montoTotal, 10000);
  assert.deepEqual(previewTryBill("100", 3, 0, 0).result.partes.map((p) => p.total), [3334, 3333, 3333]);
});

test("C · birthday: six S/ 30 plates, Jaime invited, five people pay S/ 36, total S/ 180", () => {
  const people = ["Jaime", "Ana", "Luis", "Rosa", "Caleb", "Sandra"].map((nombre, i) => ({ id: `p${i}`, nombre, consumo: 3000, invitado: nombre === "Jaime" }));
  const result = calculateQuickBill({ nombre: "Cumple de Jaime", cobrarA: "Ana", instrucciones: "", extras: 0, division: "consumos", totalCuenta: 18000, participantes: people });
  assert.equal(result.montoTotal, 18000);
  assert.equal(result.cantidadPagadores, 5);
  assert.equal(result.partes.find((p) => p.nombre === "Jaime").total, 0);
  assert.deepEqual(result.partes.filter((p) => !p.invitado).map((p) => p.total), [3600, 3600, 3600, 3600, 3600]);
});

test("D · S/ 10 then S/ 15 received is S/ 25 confirmed, and correcting to S/ 25 never makes it S/ 35", () => {
  const share = 3600;
  const first = nextContribution("ahora", 0, share, 1000);
  assert.equal(first.total, 1000);
  const second = nextContribution("ahora", first.total, share, 1500);
  assert.equal(second.total, 2500);
  // A correction replaces the confirmed total; it is not added again.
  assert.equal(nextContribution("corregir", 2500, share, 2500).total, 2500);
  // What is stored is cumulative, so replaying the same request cannot add twice.
  const input = { nombre: "Cumple", cobrarA: "", instrucciones: "", extras: 0, division: "igual", totalCuenta: 7200, participantes: [person("a"), person("b")] };
  assert.equal(quickBillProgress(input, { a: 2500 }).cobrado, 2500);
  assert.equal(quickBillProgress(input, { a: 2500 }).pendiente, 4700);
  // Over-payments and nonsense are refused before reaching the server.
  assert.match(nextContribution("ahora", 2500, share, 1200).error, /solo le falta S\/ 11\.00/);
  assert.ok(nextContribution("ahora", 0, share, 0).error);
  assert.ok(nextContribution("ahora", 0, share, null).error);
  assert.ok(nextContribution("corregir", 0, share, 3601).error);
});

test("E · a reported but unconfirmed payment keeps the debt and says why", () => {
  const members = [{ id: "ana", nombre: "Ana" }, { id: "luis", nombre: "Luis" }];
  const expense = { montoTotal: 12000, pagadoPor: "ana", participantes: [{ usuarioId: "ana", montoAsignado: 6000 }, { usuarioId: "luis", montoAsignado: 6000 }] };
  const reported = calculateAccounts(members, [expense], [{ pagadorId: "luis", receptorId: "ana", monto: 6000, estado: "reportado" }]);
  assert.deepEqual(reported.saldos.map((s) => [s.deudorId, s.acreedorId, s.monto]), [["luis", "ana", 6000]]);
  const confirmed = calculateAccounts(members, [expense], [{ pagadorId: "luis", receptorId: "ana", monto: 6000, estado: "exitoso" }]);
  assert.deepEqual(confirmed.saldos, []);
  // Luis still sees the debt, marked as waiting for Ana; Ana is asked to confirm.
  const group = { id: "g", nombre: "Depa", miembros: members.map((m) => ({ usuarioId: m.id, usuario: m })), resumen: { saldos: reported.saldos } };
  const payment = { id: "p1", grupoId: "g", pagadorId: "luis", receptorId: "ana", monto: 6000, estado: "reportado" };
  const forLuis = pendingActions([group], [payment], "luis");
  assert.equal(forLuis[0].kind, "pagar");
  assert.equal(forLuis[0].enEspera, true);
  assert.equal(forLuis[0].monto, 6000);
  assert.equal(pendingActions([group], [payment], "ana")[0].kind, "confirmar");
});
