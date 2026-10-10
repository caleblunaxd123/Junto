const { test } = require("node:test");
const assert = require("node:assert/strict");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { createPushTransport } = require("../apps/api/src/lib/pushTransport.ts");

test("push requests are capped at six and carry an abort signal", async () => {
  let active = 0, peak = 0;
  const client = createPushTransport(async (_url, options) => {
    assert.ok(options.signal);
    assert.equal(options.headers.Authorization, "Bearer fictional-qa-only");
    active++; peak = Math.max(active, peak);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return { ok: true, json: async () => ({ data: { status: "ok", id: "local-ticket" } }) };
  }, "fictional-qa-only");
  await Promise.all(Array.from({ length: 20 }, () => client.send("fictional-token", "QA", "QA")));
  assert.equal(peak, 6);
});
test("HTTP and network errors are not silently successful or blindly retried", async () => {
  let count = 0;
  const client = createPushTransport(async () => { count++; return { ok: false, status: 429 }; });
  await assert.rejects(client.send("token", "QA", "QA"), /PushHTTP429/);
  assert.equal(count, 1);
  const offline = createPushTransport(async () => { throw new Error("offline"); });
  await assert.rejects(offline.send("token", "QA", "QA"), /offline/);
});
