const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({
  transpileOnly: true,
  compilerOptions: { module: "CommonJS", moduleResolution: "node" },
});
const {
  parseMoney,
  allocatePreview,
} = require("../apps/mobile/src/lib/expensePreview.ts");
const { accountSummary } = require("../apps/mobile/src/lib/accountSummary.ts");
const {
  validInvitationCode,
  authenticatedDestination,
} = require("../apps/mobile/src/lib/invitation.ts");

test("soles are parsed exactly; malformed or negative input is never accepted", () => {
  assert.equal(parseMoney("120,50"), 12050);
  assert.equal(parseMoney(" 0.01 "), 1);
  assert.equal(parseMoney("0"), 0);
  for (const input of [
    "",
    "-10",
    "1.001",
    "S/ 12",
    "Infinity",
    "1,2,3",
    "100000000",
  ])
    assert.equal(parseMoney(input), null);
});
test("preview assigns every cent, including thirds and zero shares", () => {
  assert.deepEqual(allocatePreview(10001, [1, 1, 1]), [3334, 3334, 3333]);
  assert.deepEqual(allocatePreview(100, [0, 1]), [0, 100]);
  assert.deepEqual(allocatePreview(1, [1, 1, 1]), [1, 0, 0]);
  for (const input of [
    [1, []],
    [1, [-1, 1]],
    [1, [NaN]],
    [-1, [1]],
    [1.5, [1]],
  ])
    assert.deepEqual(allocatePreview(...input), []);
});
test("debts and receivables in different groups are not disguised as a single balance", () => {
  const groups = [
    { id: "a", balanceUsuario: { teDeben: 6000, debes: 0, neto: 6000 } },
    { id: "b", balanceUsuario: { teDeben: 0, debes: 5000, neto: -5000 } },
    { id: "c", balanceUsuario: { teDeben: 0, debes: 0, neto: 0 } },
  ];
  const payments = [
    { grupoId: "a", estado: "reportado" },
    { grupoId: "b", estado: "exitoso" },
    { grupoId: "foreign", estado: "reportado" },
  ];
  assert.deepEqual(accountSummary(groups, payments), {
    owed: 6000,
    owes: 5000,
    current: 1,
    pending: [payments[0]],
  });
  assert.deepEqual(accountSummary([]), {
    owed: 0,
    owes: 0,
    current: 0,
    pending: [],
  });
});
test("invitation survives authentication without accepting arbitrary redirects", () => {
  const code = "QA-invite_1234";
  assert.equal(validInvitationCode(code), true);
  assert.deepEqual(authenticatedDestination(code), {
    pathname: "/unirse/[code]",
    params: { code },
  });
  for (const value of [
    null,
    undefined,
    [],
    "a",
    "../../perfil",
    "https://example.com",
    "a".repeat(129),
  ])
    assert.equal(validInvitationCode(value), false);
  assert.equal(authenticatedDestination(null), "/(app)");
});
const { memberLabels, meFirst, initials, avatarColors } = require("../apps/mobile/src/lib/people.ts");
const { pendingActions } = require("../apps/mobile/src/lib/pending.ts");
const { invitationUrl, extractInvitationCode } = require("../apps/mobile/src/lib/invitation.ts");
test("the viewer is always «Tú» and namesakes are told apart", () => {
  const people = [
    { id: "me", nombre: "Usuario Nuevo QA", email: "qa1@x.pe" },
    { id: "b", nombre: "Usuario Nuevo QA", email: "qa2@x.pe" },
    { id: "c", nombre: "Juan Pérez" },
    { id: "d", nombre: "Juan Quispe" },
    { id: "e", nombre: "Ana" },
    { id: "f", nombre: "Luis Rojas", email: "luis@x.pe" },
    { id: "g", nombre: "Luis Rojas", email: "lr@x.pe" },
  ];
  const labels = memberLabels(people, "me");
  assert.equal(labels.get("me"), "Tú");
  assert.equal(labels.get("b"), "Usuario");
  assert.equal(labels.get("c"), "Juan P.");
  assert.equal(labels.get("d"), "Juan Q.");
  assert.equal(labels.get("e"), "Ana");
  assert.equal(labels.get("f"), "Luis Rojas (luis)");
  assert.equal(labels.get("g"), "Luis Rojas (lr)");
  assert.equal(new Set([...labels.values()]).size, people.length);
  assert.deepEqual(meFirst(people, (p) => p.id, "f").map((p) => p.id)[0], "f");
  assert.equal(initials("ana maría  López"), "AL");
  assert.equal(initials("  "), "?");
  assert.notDeepEqual(avatarColors("b"), avatarColors("me"));
});
test("pending actions put the payment to confirm first and keep groups apart", () => {
  const member = (id, nombre) => ({ usuarioId: id, usuario: { id, nombre } });
  const groups = [
    { id: "g1", nombre: "Depa", miembros: [member("me", "Caleb"), member("luis", "Luis Rojas")], resumen: { saldos: [{ deudorId: "luis", deudorNombre: "Luis Rojas", acreedorId: "me", acreedorNombre: "Caleb", monto: 6000 }] } },
    { id: "g2", nombre: "Viaje", miembros: [member("me", "Caleb"), member("ana", "Ana")], resumen: { saldos: [{ deudorId: "me", deudorNombre: "Caleb", acreedorId: "ana", acreedorNombre: "Ana", monto: 4000 }] } },
  ];
  const payments = [{ id: "p1", grupoId: "g1", pagadorId: "luis", receptorId: "me", monto: 6000, estado: "reportado" }];
  const actions = pendingActions(groups, payments, "me");
  assert.deepEqual(actions.map((a) => [a.kind, a.persona, a.monto]), [["confirmar", "Luis", 6000], ["pagar", "Ana", 4000], ["cobrar", "Luis", 6000]]);
  assert.equal(actions[2].porConfirmar, true);
  assert.deepEqual(pendingActions(groups, payments, null), []);
});
test("invitation links are https web links and pasted links or codes are accepted", () => {
  assert.equal(invitationUrl("QA-invite_1234", "https://junto.pe/"), "https://junto.pe/unirse/QA-invite_1234");
  assert.equal(invitationUrl("QA-invite_1234", ""), "junto://unirse/QA-invite_1234");
  assert.equal(extractInvitationCode("Únete en JUNTO: https://junto.pe/unirse/QA-invite_1234 "), "QA-invite_1234");
  assert.equal(extractInvitationCode("junto://unirse/QA-invite_1234"), "QA-invite_1234");
  assert.equal(extractInvitationCode(" QA-invite_1234 "), "QA-invite_1234");
  assert.equal(extractInvitationCode("hola"), null);
});
