const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { homeState, pendingDayBills } = require("../apps/mobile/src/lib/homeState.ts");
const loaded = { loading: false, error: false, hasData: true };
const failed = { loading: false, error: true, hasData: false };
const loading = { loading: true, error: false, hasData: false };

test("empty home requires all queries to succeed, not merely zero default counts", () => {
  assert.equal(homeState(loaded, loaded, loaded, 0, 0).empty, true);
  for (const query of [failed, loading]) {
    assert.equal(homeState(query, loaded, loaded, 0, 0).empty, false);
    assert.equal(homeState(loaded, query, loaded, 0, 0).empty, false);
    assert.equal(homeState(loaded, loaded, query, 0, 0).empty, false);
  }
  assert.equal(homeState(loaded, loaded, loaded, 0, 1).empty, false);
});
test("one unavailable state replaces total failure, including stale cached records", () => {
  assert.equal(homeState(failed, failed, failed, 0, 0).unavailable, true);
  assert.equal(homeState(loaded, failed, failed, 2, 0).unavailable, false);
  assert.equal(homeState({ ...failed, hasData: true }, failed, failed, 2, 0).unavailable, true);
});
test("unknown or stale pending payments never claim that the user is all clear", () => {
  assert.equal(homeState(loaded, loaded, loaded, 1, 0).canShowAllClear, true);
  assert.equal(homeState(loaded, failed, loaded, 1, 0).canShowAllClear, false);
  assert.equal(homeState(loaded, { ...failed, hasData: true }, loaded, 1, 0).canShowAllClear, false);
  assert.equal(homeState({ ...failed, hasData: true }, loaded, loaded, 1, 0).canShowAllClear, false);
  assert.equal(homeState(loaded, loaded, failed, 1, 0).canShowAllClear, false);
  assert.equal(homeState(loaded, loaded, loading, 1, 0).canShowAllClear, false);
});

test("S/120 in a day bill remains pending even when groups have no debt", () => {
  const pending = pendingDayBills([{ archivada: false, pendiente: 12000 }, { archivada: true, pendiente: 50000 }, { archivada: false, pendiente: 0 }]);
  assert.deepEqual(pending, { count: 1, cents: 12000 });
  const state = homeState(loaded, loaded, loaded, 1, 2, pending.count);
  assert.equal(state.canShowAllClear, false);
  assert.equal(state.canShowGroupsClear, true);
  assert.deepEqual(pendingDayBills([]), { count: 0, cents: 0 });
  assert.deepEqual(pendingDayBills([{ archivada: false, pendiente: 1 }, { archivada: false, pendiente: 2 }]), { count: 2, cents: 3 });
});
