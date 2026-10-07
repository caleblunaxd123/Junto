// What the payer and the approvers read around a voucher: checks before sending, who approves,
// headlines, and the cards an approving admin gets. Pure logic, no server.
const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { voucherChecks, blocksSending, approvalSentence, paymentHeadline } = require("../apps/mobile/src/lib/payment.ts");
const { pendingActions } = require("../apps/mobile/src/lib/pending.ts");

const names = { marta: "Marta", ana: "Ana", pedro: "Pedro", luis: "Luis" };
const nombre = (id) => names[id];
const reading = (extra = {}) => ({ leido: true, monto: 2500, duplicado: null, sugerenciaReceptorId: "marta", destinatario: "Marta Q. Ríos", advertencias: [], ...extra });

test("a clean voucher for the right person and amount raises nothing", () => {
  assert.deepEqual(voucherChecks({ lectura: reading(), monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] }), []);
  assert.deepEqual(voucherChecks({ lectura: null, monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] }), []);
});

test("a voucher already used blocks sending", () => {
  const checks = voucherChecks({ lectura: reading({ duplicado: "Este comprobante ya se usó para registrar otro pago." }), monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.equal(checks[0].tone, "danger");
  assert.equal(blocksSending(checks), true);
});

test("paying more than owed offers to register exactly the debt", () => {
  const [check] = voucherChecks({ lectura: reading({ monto: 3000 }), monto: 2550, limite: 2550, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.match(check.text, /dice S\/ 30\.00, pero le debes S\/ 25\.50 a Marta/);
  assert.equal(check.fix, undefined, "already registering the debt: nothing to fix");
  const [withFix] = voucherChecks({ lectura: reading({ monto: 3000 }), monto: 1000, limite: 2550, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.deepEqual(withFix.fix, { label: "Registrar S/ 25.50", monto: 2550 });
  assert.equal(blocksSending([withFix]), false);
});

test("a different typed amount is visible to the approver, not hidden", () => {
  const [check] = voucherChecks({ lectura: reading(), monto: 2000, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.match(check.text, /dice S\/ 25\.00 y vas a registrar S\/ 20\.00/);
});

test("a voucher for someone else is flagged, worded by whether you owe them", () => {
  const [owed] = voucherChecks({ lectura: reading({ sugerenciaReceptorId: "ana" }), monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta", "ana"] });
  assert.match(owed.text, /parece ser para Ana, no para Marta/);
  const [stranger] = voucherChecks({ lectura: reading({ sugerenciaReceptorId: "pedro" }), monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.match(stranger.text, /para Pedro, y no le debes nada/);
  const [unknown] = voucherChecks({ lectura: reading({ sugerenciaReceptorId: null, destinatario: "J. Pérez" }), monto: 2500, limite: 2500, receptorId: "marta", nombre, acreedores: ["marta"] });
  assert.equal(unknown.tone, "info");
  assert.match(unknown.text, /«J\. Pérez»/);
});

test("who approves, said in one sentence", () => {
  assert.match(approvalSentence("Marta", []), /^Lo aprueba Marta, quien recibe el dinero\.$/);
  assert.match(approvalSentence("Marta", ["Ana"]), /Marta \(quien recibe\) o Ana \(administración del grupo\)/);
});

test("headlines tell each person where the payment stands", () => {
  const base = { estado: "reportado", monto: 2500, pagadorId: "luis", receptorId: "marta" };
  assert.match(paymentHeadline(base, "marta", nombre).body, /Luis dice que te pagó S\/ 25\.00/);
  assert.match(paymentHeadline(base, "luis", nombre).body, /Tu deuda baja cuando lo aprueben/);
  const byAdmin = { ...base, estado: "exitoso", resueltoPor: "ana" };
  assert.equal(paymentHeadline(byAdmin, "luis", nombre).title, "Aprobado por Ana");
  assert.equal(paymentHeadline(byAdmin, "ana", nombre).title, "Lo aprobaste");
  assert.match(paymentHeadline(byAdmin, "marta", nombre).body, /Si no te llegó, avísalo abajo/);
  assert.equal(paymentHeadline({ ...base, estado: "exitoso", resueltoPor: "marta" }, "luis", nombre).title, "Pago confirmado");
  assert.equal(paymentHeadline({ ...base, estado: "rechazado", resueltoPor: "marta" }, "marta", nombre).title, "Indicaste que no llegó");
});

test("an approving admin gets a review card; others and the payer do not", () => {
  const group = {
    id: "g", nombre: "Depa",
    miembros: ["ana", "luis", "marta"].map((id) => ({ usuarioId: id, usuario: { id, nombre: names[id] } })),
    resumen: { saldos: [{ deudorId: "luis", deudorNombre: "Luis", acreedorId: "marta", acreedorNombre: "Marta", monto: 2500 }] },
  };
  const payment = { id: "p", grupoId: "g", pagadorId: "luis", receptorId: "marta", monto: 2500, estado: "reportado", metodo: "yape", comprobante: { id: "c" } };
  const admin = pendingActions([group], [{ ...payment, permisos: { aprobar: true } }], "ana");
  assert.deepEqual(admin.map((a) => a.kind), ["revisar"]);
  assert.equal(admin[0].conComprobante, true);
  assert.equal(admin[0].receptor, "Marta");
  // Without permission (approval only by the receiver) nothing shows up for Ana.
  assert.deepEqual(pendingActions([group], [{ ...payment, permisos: { aprobar: false } }], "ana"), []);
  // The receiver keeps the quick confirm card, now knowing there is a voucher.
  const receiver = pendingActions([group], [{ ...payment, permisos: { aprobar: true } }], "marta");
  assert.equal(receiver[0].kind, "confirmar");
  assert.equal(receiver[0].conComprobante, true);
  // The payer sees the debt as waiting, never an approval card.
  assert.deepEqual(pendingActions([group], [{ ...payment, permisos: { aprobar: false } }], "luis").map((a) => [a.kind, a.enEspera]), [["pagar", true]]);
});
