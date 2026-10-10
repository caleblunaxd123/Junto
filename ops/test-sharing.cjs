const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { validShareEmail, emailDraftUrl, whatsappDraftUrl, expenseShareMessage, groupShareMessage } = require("../apps/mobile/src/lib/shareMessage.ts");
const { calculateQuickBill, quickBillBrief } = require("../packages/shared/quickBill.js");
const expense = {
  descripcion: "Cena & taxi", montoTotal: 12000, pagador: { nombre: "Caleb" },
  participantes: [
    { usuario: { nombre: "Caleb" }, montoAsignado: 4000 },
    { usuario: { nombre: "Ana" }, montoAsignado: 4000 },
    { usuario: { nombre: "Luis" }, montoAsignado: 4000 },
  ],
};
test("expense exports exact shares but never calls them outstanding debts", () => {
  const message = expenseShareMessage(expense, "Cena QA");
  assert.match(message.body, /Total del gasto: S\/ 120.00/);
  assert.match(message.body, /Ana: S\/ 40.00/);
  assert.match(message.body, /no los saldos pendientes/);
  assert.doesNotMatch(message.body, /Tú|te debe/);
  assert.equal(message.preview.total, 12000);
  assert.deepEqual(message.preview.rows.map(p => p.amount), [4000, 4000, 4000]);
  assert.match(message.preview.note, /no las deudas pendientes/);
});
test("invalid, negative, or inconsistent amounts cannot be exported", () => {
  assert.throws(() => expenseShareMessage({ ...expense, montoTotal: 50000 }, "Cena"));
  assert.throws(() => expenseShareMessage({ ...expense, montoTotal: -12000 }, "Cena"));
});
test("group snapshot explains confirmed settlements and pending payments", () => {
  const message = groupShareMessage({ nombre: "Cusco", resumen: { totalGastado: 18000, cantidadGastos: 2, cuentas: [
    { nombre: "Caleb", tuParte: 6000, pagaste: 12000, neto: 6000 },
    { nombre: "Ana", tuParte: 6000, pagaste: 6000, neto: 0 },
    { nombre: "Luis", tuParte: 6000, pagaste: 0, neto: -6000 },
  ] }, saldos: [{ deudorNombre: "Luis", acreedorNombre: "Caleb", monto: 6000 }] }, 1);
  assert.match(message.body, /Luis → Caleb: S\/ 60.00/);
  assert.match(message.body, /NO descuentan la deuda/);
  assert.match(message.body, /Ana.*Al día/);
  assert.deepEqual(message.preview.rows.map(p => [p.amount, p.tone]), [[6000, "receivable"], [0, "settled"], [6000, "payable"]]);
  assert.equal(message.preview.total, 18000);
  assert.equal(message.preview.reconciled, undefined);
});
test("only one explicit email is accepted, never injected headers or recipients", () => {
  assert.equal(validShareEmail("calebluna41@gmail.com"), true);
  for (const value of ["x", "a@b.com,b@b.com", "a@b.com;z@z.com", "a@b.com\r\nBcc: x@b.com", "a+b@example.invalid?bcc=z@b.com"]) {
    assert.equal(validShareEmail(value), false, value);
  }
});
test("mailto round trips accents and body without header injection", () => {
  const message = { subject: "JUNTO · Cumpleaños\r\nBcc: otro", body: "Ana: S/ 36.00\nA&B + invitados ❤️" };
  const url = new URL(emailDraftUrl(message, "calebluna41@gmail.com"));
  assert.equal(url.searchParams.get("body"), message.body);
  assert.equal(url.searchParams.has("bcc"), false);
  assert.doesNotMatch(url.searchParams.get("subject"), /[\r\n]/);
  assert.throws(() => emailDraftUrl(message, "a@b.com\n"));
});
test("recipient cannot inject mailto parameters, fragments, or hidden copies", () => {
  const message = { subject: "Cuenta", body: "S/ 180.00" };
  for (const recipient of ["a@example.com?bcc=spy%40example.com", "a@example.com#fragment", "a@example.com&cc=spy", "a..b@example.com", ".a@example.com", "a@-example.com"])
    assert.throws(() => emailDraftUrl(message, recipient));
  const url = new URL(emailDraftUrl(message, "ana+cuentas%2B@example.com"));
  assert.equal(decodeURIComponent(url.pathname), "ana+cuentas%2B@example.com");
  assert.deepEqual([...url.searchParams.keys()], ["subject", "body"]);
});
test("WhatsApp pre-fills encoded text without guessing a recipient", () => {
  const message = { subject: "JUNTO", body: "Cumpleaños · S/ 180\nAna & Luis" };
  for (const web of [false, true]) {
    const url = new URL(whatsappDraftUrl(message, web));
    assert.equal(url.searchParams.get("text"), message.body);
    assert.equal(url.searchParams.has("phone"), false);
  }
});

test("WhatsApp uses only the Peruvian phone explicitly entered, never auto-sends", () => {
  const message = {subject: "JUNTO", body: "Únete a mi grupo · no es un cobro"};
  for (const value of ["999888777", "+51 999888777", "51999888777"]) {
    const web = new URL(whatsappDraftUrl(message, true, value));
    assert.equal(web.origin, "https://wa.me");
    assert.equal(web.pathname, "/51999888777");
    assert.equal(web.searchParams.get("text"), message.body);
    const native = new URL(whatsappDraftUrl(message, false, value));
    assert.equal(native.searchParams.get("phone"), "51999888777");
    assert.deepEqual([...native.searchParams.keys()], ["phone", "text"]);
  }
  for (const value of ["123", "899888777", "+1 999888777", "999888777&text=evil", "999888777?send=true"])
    assert.throws(() => whatsappDraftUrl(message, true, value));
});
test("birthday report explains invitees, exactly five shares and total", () => {
  const input = { nombre: "Cumpleaños QA", cobrarA: "Davetsy", instrucciones: "", division: "igual", totalCuenta: 18000, participantes: ["Jaime", "Davetsy", "Gerson", "Caleb", "Sandra", "Lili"].map((nombre, i) => ({ id: String(i), nombre, invitado: i === 0, consumo: 0 })) };
  const result = calculateQuickBill(input);
  assert.equal(result.montoTotal, 18000);
  assert.deepEqual(result.partes.map(p => p.total), [0, 3600, 3600, 3600, 3600, 3600]);
  assert.match(quickBillBrief(input), /36.00/);
});
test("WhatsApp visibility is narrowly scoped and prebuild is idempotent", () => {
  const { addWhatsAppQuery } = require("../apps/mobile/plugins/withShareTargets");
  const manifest = { manifest: { queries: [{ intent: [{ action: [{ $: { "android:name": "android.intent.action.VIEW" } }], data: [{ $: { "android:scheme": "https" } }] }] }] } };
  addWhatsAppQuery(manifest); addWhatsAppQuery(manifest);
  assert.equal(manifest.manifest.queries[0].intent.length, 2);
  assert.equal(manifest.manifest.queries[0].intent[1].data[0].$["android:scheme"], "whatsapp");
  assert.ok(!JSON.stringify(manifest).includes("QUERY_ALL_PACKAGES"));
});
