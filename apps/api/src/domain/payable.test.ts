import test from "node:test";
import assert from "node:assert/strict";
import { payableLimit } from "@junto/shared/payable";

test("a payment made before the suggestions changed still fits (owed by both sides)", () => {
  // A paid C 30 when the app suggested it; then D added an expense for A and suggestions became
  // A→D 40, A→C 10. Paying C 30 is still valid: C is owed 30 and A owes 50.
  const accounts = [{ usuarioId: "A", neto: -5000 }, { usuarioId: "B", neto: -2000 }, { usuarioId: "C", neto: 3000 }, { usuarioId: "D", neto: 4000 }];
  assert.deepEqual(payableLimit(accounts, [], "A", "C"), { owes: 5000, owed: 3000, limit: 3000 });
  assert.equal(payableLimit(accounts, [], "A", "D").limit, 4000);
});

test("payments waiting for approval count on both sides; nobody can over-report", () => {
  const accounts = [{ usuarioId: "A", neto: -3000 }, { usuarioId: "C", neto: 2000 }, { usuarioId: "D", neto: 1000 }];
  // A already reported 2500 to C: only 500 of A's debt is left to report to anyone.
  assert.equal(payableLimit(accounts, [{ pagadorId: "A", receptorId: "C", monto: 2500 }], "A", "D").limit, 500);
  // Someone else's pending payment to D also reduces what D can still receive.
  assert.equal(payableLimit(accounts, [{ pagadorId: "X", receptorId: "D", monto: 800 }], "A", "D").limit, 200);
  assert.equal(payableLimit(accounts, [], "C", "D").limit, 0, "C owes nothing");
  assert.equal(payableLimit(accounts, [], "A", "A").owed, 0, "the payer is not owed");
});
