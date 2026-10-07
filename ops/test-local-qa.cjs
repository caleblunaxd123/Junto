const { test } = require("node:test");
const assert = require("node:assert/strict");
const { localQa } = require("./local-qa.cjs");
test("integration fixtures stay in explicit local JUNTO databases and loopback APIs", () => {
  for (const DATABASE_URL of ["postgresql://qa:qa@localhost:5433/junto_db", "postgresql://qa:qa@127.0.0.1:5433/junto_sync_qa_20261007", "postgresql://qa:qa@[::1]:5432/junto_voucher_qa"])
    assert.equal(localQa({ DATABASE_URL }), "http://localhost:3005/api");
});
test("misleading URL fragments, remote hosts, wrong databases and remote APIs are refused", () => {
  for (const DATABASE_URL of ["postgresql://localhost:5433/junto_db@remote.invalid/prod", "postgresql://qa@remote.invalid/junto_db?host=localhost", "postgresql://qa@localhost/production", "postgresql://qa@localhost/junto_db?host=remote.invalid", "https://localhost/junto_db", ""])
    assert.throws(() => localQa({ DATABASE_URL }));
  for (const JUNTO_QA_API of ["https://remote.invalid/api", "http://localhost@remote.invalid/api", "http://localhost:3005/api?x=1", "http://localhost:3005/other"])
    assert.throws(() => localQa({ DATABASE_URL: "postgresql://qa@localhost/junto_db", JUNTO_QA_API }));
});
