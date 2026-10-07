const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { validateQuickBillDraft } = require("../apps/mobile/src/lib/quickBillValidation.ts");
const { parsePercentage } = require("../apps/mobile/src/lib/expensePreview.ts");
const draft = { name: "Cena QA", recipient: "Ana", instructions: "", billTotal: "500", extras: "0", division: "consumos", scanApproved: true, names: "", people: [100, 50, 150, 70, 10].map((n, i) => ({ id: `p${i}`, nombre: `Persona ${i + 1}`, consumo: String(n), invitado: false })) };

test("500 receipt vs 380 consumptions cannot preview or save a false total", () => {
  const result = validateQuickBillDraft(draft);
  assert.equal(result.total, 50000); assert.equal(result.consumptions, 38000); assert.equal(result.difference, 12000);
  assert.match(result.stepErrors[1], /Faltan S\/ 120.00/);
  assert.equal(result.result, undefined); assert.equal(result.valid, false);
  assert.equal(result.stepErrors[0], "", "A valid receipt total still allows the people step");
});
test("correcting a consumption preserves the receipt and extras are added separately", () => {
  const valid = { ...draft, people: draft.people.map((p, i) => i === 4 ? { ...p, consumo: "130" } : p), extras: "20" };
  const result = validateQuickBillDraft(valid);
  assert.equal(result.valid, true); assert.equal(result.input.totalCuenta, 50000);
  assert.equal(result.result.montoTotal, 52000);
  assert.equal(result.result.partes.reduce((sum, p) => sum + p.total, 0), 52000);
  assert.equal(validateQuickBillDraft({ ...draft, extras: "120" }).valid, false, "Extras cannot disguise missing consumptions");
});
test("overassignment, one-cent differences and blank consumptions remain invalid", () => {
  assert.match(validateQuickBillDraft({ ...draft, billTotal: "379.99" }).stepErrors[1], /Sobran S\/ 0.01/);
  for (const consumo of ["", "-10", "1.001", "Infinity", "1e2", "0x32", "1,2,3"]) {
    const result = validateQuickBillDraft({ ...draft, people: [{ ...draft.people[0], consumo }] });
    assert.equal(result.valid, false, consumo); assert.ok(result.fields["amount:p0"], consumo);
  }
});
test("receipt required for both modes; OCR approval and final overflow are checked", () => {
  for (const division of ["igual", "consumos"]) for (const billTotal of ["", "0", "-500", "500.001", "1e3", "10000000"]) assert.equal(validateQuickBillDraft({ ...draft, division, billTotal }).valid, false);
  assert.ok(validateQuickBillDraft({ ...draft, scanApproved: false }).fields.scan);
  assert.ok(validateQuickBillDraft({ ...draft, division: "igual", billTotal: "9999999.99", extras: "0.01" }).fields.extras);
});
test("zero explicit consumption is valid; duplicates and all invitees are not", () => {
  const valid = { ...draft, billTotal: "100", people: [{ ...draft.people[0], consumo: "100" }, { ...draft.people[1], consumo: "0" }] };
  assert.equal(validateQuickBillDraft(valid).valid, true);
  assert.equal(validateQuickBillDraft({ ...valid, people: valid.people.map((p) => ({ ...p, invitado: true })) }).valid, false);
  const duplicate = { ...valid, people: valid.people.map((p, i) => ({ ...p, nombre: i ? " Ana  Pérez " : "ana pérez" })) };
  assert.ok(validateQuickBillDraft(duplicate).fields["name:p0"]);
  assert.ok(validateQuickBillDraft({ ...valid, people: [{ ...valid.people[0], nombre: "   " }] }).fields["name:p0"]);
});
test("unapplied name lists and invalid final metadata cannot silently save", () => {
  const valid = { ...draft, division: "igual" };
  assert.equal(validateQuickBillDraft(valid).valid, true);
  for (const patch of [{ name: " " }, { name: "x".repeat(101) }, { names: "Ana, Beto" }, { recipient: "x".repeat(101) }, { instructions: "x".repeat(501) }, { extras: "-1" }]) assert.equal(validateQuickBillDraft({ ...valid, ...patch }).valid, false);
});
test("percentages use ordinary decimals only; empty must not silently become zero", () => {
  for (const value of ["", " ", "-1", "100.01", "50.001", "1e2", "0x32", "Infinity", "50%", "1,2,3"]) assert.equal(parsePercentage(value), null, value);
  assert.equal(parsePercentage("0"), 0); assert.equal(parsePercentage("33,33"), 33.33); assert.equal(parsePercentage("100"), 100);
});
