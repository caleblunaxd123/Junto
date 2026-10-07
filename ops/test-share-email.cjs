const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { shareEmailHtml } = require("../apps/mobile/src/lib/shareEmail.ts");
const { tryBillShareMessage } = require("../apps/mobile/src/lib/tryBill.ts");
const { groupShareMessage } = require("../apps/mobile/src/lib/shareMessage.ts");
const bill = { nombre: "Cumpleaños de Jaime", cobrarA: "Davetsy", instrucciones: "Yape al número acordado\nConfirma al recibir", division: "igual", totalCuenta: 18000, extras: 0,
  participantes: ["Jaime", "Davetsy", "Gerson", "Caleb", "Sandra", "Lili"].map((nombre, i) => ({ id: String(i), nombre, consumo: 0, invitado: i === 0 })) };

test("email has branded, table-based layout with exact totals and guest exclusions", () => {
  const html = shareEmailHtml(tryBillShareMessage(bill));
  assert.match(html, /lang="es"/);
  assert.match(html, /max-width:600px/);
  assert.match(html, /Total de la cuenta/);
  assert.match(html, /S\/ 180.00/);
  assert.equal((html.match(/S\/ 36.00/g) || []).length, 5);
  assert.match(html, /Invitado\/a · no aporta/);
  assert.match(html, /Recibe los aportes/);
  assert.match(html, /Yape al número acordado<br>Confirma al recibir/);
  assert.match(html, /no es un comprobante de pago/);
  assert.doesNotMatch(html, /<script|<img|<iframe|display:flex|onclick=/i);
});
test("all user-supplied fields are escaped, never interpreted as HTML", () => {
  const message = tryBillShareMessage(bill);
  message.subject = '<svg onload="evil()">';
  message.preview.title = '<script>alert(1)</script>';
  message.preview.caption = '<img src=x onerror="evil()">';
  message.preview.rows[0].name = '<a href="javascript:evil()">Ana</a>';
  message.preview.payment.instructions = '<iframe src="https://spy.invalid">';
  const html = shareEmailHtml(message);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /&lt;iframe/);
  assert.doesNotMatch(html, /<script|<svg|<iframe|<a href|<img/i);
});
test("email never rounds each third up or accepts non-integer amounts", () => {
  const message = tryBillShareMessage({ ...bill, totalCuenta: 10000, cobrarA: "", instrucciones: "", participantes: bill.participantes.slice(1, 4) });
  const html = shareEmailHtml(message);
  assert.equal((html.match(/S\/ 33.34/g) || []).length, 1);
  assert.equal((html.match(/S\/ 33.33/g) || []).length, 2);
  message.preview.rows[0].amount = NaN;
  assert.throws(() => shareEmailHtml(message), /Monto inválido/);
});
test("plain messages are escaped and preserve line breaks without tracking", () => {
  const html = shareEmailHtml({ subject: "Invitación <QA>", body: "Grupo & amigos\nhttps://junto.invalid/unirse/QA" });
  assert.match(html, /Invitación &lt;QA&gt;/);
  assert.match(html, /Grupo &amp; amigos<br>/);
  assert.doesNotMatch(html, /src=|<script/);
});
test("group email explains payment direction and never discounts unconfirmed payments", () => {
  const message = groupShareMessage({ nombre: "Cusco QA", resumen: { totalGastado: 18000, cantidadGastos: 2, cuentas: [
    { nombre: "Caleb", tuParte: 6000, pagaste: 12000, neto: 6000 },
    { nombre: "Ana", tuParte: 6000, pagaste: 6000, neto: 0 },
    { nombre: "Luis", tuParte: 6000, pagaste: 0, neto: -6000 },
  ] }, saldos: [{ deudorNombre: "Luis", acreedorNombre: "Caleb", monto: 6000 }] }, 1);
  const html = shareEmailHtml(message);
  assert.match(html, /Luis → Caleb/);
  assert.match(html, /Por cobrar/);
  assert.match(html, /Por pagar/);
  assert.match(html, /Al día/);
  assert.match(html, /Parte S\/ 60.00 · Adelantó S\/ 120.00/);
  assert.match(html, /Todavía no descuentan la deuda/);
});
const { shareEmailText, shareFingerprint } = require("../packages/shared/share.js");
test("sent by JUNTO: the sender is named, escaped, and a text alternative carries the same content", () => {
  const message = tryBillShareMessage(bill);
  const html = shareEmailHtml(message, { sentBy: 'Eve <img src=x onerror="steal()">' });
  assert.match(html, /Eve &lt;img src=x onerror=&quot;steal\(\)&quot;&gt;<\/strong> te compartió este resumen/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /Recibes este correo porque/);
  const text = shareEmailText(message, { sentBy: "Ana\r\nBcc: spy@x.com" });
  assert.match(text, /^Ana\s+Bcc: spy@x\.com te compartió/, "line breaks in names cannot fake headers or lines");
  assert.ok(text.includes(message.body));
  // Without a sender (e-mail opened in the person's own app) nothing changes.
  assert.doesNotMatch(shareEmailHtml(message), /te compartió/);
});
test("the review fingerprint is stable and changes with any amount or name", () => {
  const message = tryBillShareMessage(bill);
  assert.equal(shareFingerprint(message), shareFingerprint(tryBillShareMessage(bill)));
  assert.match(shareFingerprint(message), /^[0-9a-f]{16}$/);
  const changed = tryBillShareMessage({ ...bill, totalCuenta: 18001 });
  assert.notEqual(shareFingerprint(changed), shareFingerprint(message));
  assert.notEqual(shareFingerprint({ ...message, body: message.body.replace("Davetsy", "Davetsi") }), shareFingerprint(message));
});
