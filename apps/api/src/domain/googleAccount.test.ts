import { test } from "node:test";
import assert from "node:assert/strict";
import { googleSignInPlan, nameFromGoogle } from "./googleAccount";

const claims = { sub: "g-1", email: "ana@gmail.com", emailVerified: true, name: "Ana Quispe" };
const account = (overrides = {}) => ({ id: "u-1", activo: true, emailVerificado: true, googleId: null, ...overrides });

test("a new Google identity creates an account; an unverified Google e-mail is refused", () => {
  assert.deepEqual(googleSignInPlan(claims, null, null), { action: "create" });
  assert.equal(googleSignInPlan({ ...claims, emailVerified: false }, null, null).action, "reject");
});
test("a linked Google identity logs in, unless the account was deactivated", () => {
  assert.deepEqual(googleSignInPlan(claims, account({ googleId: "g-1" }), null), { action: "login", userId: "u-1" });
  assert.equal(googleSignInPlan(claims, account({ googleId: "g-1", activo: false }), null).action, "reject");
});
test("an existing e-mail account is linked; an unverified one loses the password nobody proved", () => {
  assert.deepEqual(googleSignInPlan(claims, null, account()), { action: "link", userId: "u-1", resetPassword: false });
  assert.deepEqual(googleSignInPlan(claims, null, account({ emailVerificado: false })), { action: "link", userId: "u-1", resetPassword: true });
});
test("an e-mail already tied to a different Google account is never taken over", () => {
  const plan = googleSignInPlan(claims, null, account({ googleId: "g-other" }));
  assert.equal(plan.action, "reject");
});
test("names come from Google, or from the e-mail when Google sends none", () => {
  assert.equal(nameFromGoogle({ name: "  Ana   Quispe ", email: "x@y.pe" }), "Ana Quispe");
  assert.equal(nameFromGoogle({ name: "", email: "luis.rojas@gmail.com" }), "luis rojas");
});
