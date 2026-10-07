const assert = require("node:assert/strict");
const { test } = require("node:test");
require("ts-node").register({ transpileOnly: true, compilerOptions: { module: "CommonJS", moduleResolution: "node" } });
const { createDialogQueue } = require("../apps/mobile/src/lib/dialogQueue.ts");

test("Android back cancels, never confirms a financial or destructive action", async () => {
  const queue = createDialogQueue();
  let confirms = 0;
  let cancels = 0;
  queue.alert("Confirmar", "", [{ text: "Volver", style: "cancel", onPress: () => cancels++ }, { text: "Confirmar", onPress: () => confirms++ }]);
  await queue.choose(queue.getSnapshot().id);
  assert.equal(confirms, 0);
  assert.equal(cancels, 1);
  assert.equal(queue.getSnapshot(), null);
});

test("double taps and stale buttons cannot repeat an async mutation", async () => {
  const queue = createDialogQueue();
  let done;
  let calls = 0;
  queue.alert("Guardar", "", [{ text: "Confirmar", onPress: () => { calls++; return new Promise((resolve) => { done = resolve; }); } }]);
  const id = queue.getSnapshot().id;
  const first = queue.choose(id, 0);
  assert.equal(queue.getSnapshot().busy, true);
  await queue.choose(id, 0);
  await queue.choose(id);
  assert.equal(calls, 1);
  done();
  await first;
  queue.alert("Siguiente");
  await queue.choose(id, 0);
  assert.equal(queue.getSnapshot().title, "Siguiente");
});

test("nested notices are queued and snapshots remain stable between updates", async () => {
  const queue = createDialogQueue();
  queue.alert("Recordatorio", "", [{ text: "Enviar", onPress: async () => queue.alert("Registrado") }]);
  assert.equal(queue.getSnapshot(), queue.getSnapshot());
  await queue.choose(queue.getSnapshot().id, 0);
  assert.equal(queue.getSnapshot().title, "Registrado");
  assert.equal(queue.getSnapshot().busy, false);
});

test("async failures are handled with an error notice, not an unhandled rejection", async () => {
  const queue = createDialogQueue();
  queue.alert("Guardar", "", [{ text: "Confirmar", onPress: async () => { throw new Error("offline"); } }]);
  await queue.choose(queue.getSnapshot().id, 0);
  assert.equal(queue.getSnapshot().tone, "danger");
  assert.match(queue.getSnapshot().title, /No pudimos/);
});

test("noncancelable notices and invalid indices do not execute actions", async () => {
  const queue = createDialogQueue();
  queue.alert("Aviso", "", undefined, { cancelable: false });
  const id = queue.getSnapshot().id;
  await queue.choose(id);
  await queue.choose(id, 3);
  assert.equal(queue.getSnapshot().id, id);
  await queue.choose(id, 0);
  assert.equal(queue.getSnapshot(), null);
});
