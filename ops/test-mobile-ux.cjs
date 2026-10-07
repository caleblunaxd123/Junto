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
