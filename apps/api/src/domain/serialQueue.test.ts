import test from "node:test";
import assert from "node:assert/strict";
import { serialQueue } from "../lib/serialQueue";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const busy = () => new Error("ocupado");

test("tasks that arrive together run one after another instead of being refused", async () => {
  const run = serialQueue({ maxWaiting: 4, maxWaitMs: 5_000 });
  const order: string[] = [];
  let running = 0;
  const job = (name: string) => run(async () => {
    running++;
    assert.equal(running, 1, "never two at once");
    order.push(`start ${name}`);
    await sleep(20);
    order.push(`end ${name}`);
    running--;
    return name;
  }, busy);
  assert.deepEqual(await Promise.all([job("a"), job("b"), job("c")]), ["a", "b", "c"]);
  assert.deepEqual(order, ["start a", "end a", "start b", "end b", "start c", "end c"]);
});

test("a full line or a too long wait answers busy; a failure does not block the next task", async () => {
  const run = serialQueue({ maxWaiting: 2, maxWaitMs: 30 });
  const slow = run(() => sleep(60).then(() => "slow"), busy);
  // Two may wait behind the running task; a third waiting one is refused right away.
  const waiting = Promise.allSettled([run(async () => "late", busy), run(async () => "second", busy)]);
  await assert.rejects(run(async () => "overflow", busy), /ocupado/);
  assert.equal(await slow, "slow");
  // Both waited 60 ms behind the slow task, more than the 30 ms allowed.
  assert.deepEqual((await waiting).map((r) => r.status === "rejected" && (r.reason as Error).message), ["ocupado", "ocupado"]);
  await assert.rejects(run(() => Promise.reject(new Error("falló")), busy), /falló/);
  assert.equal(await run(async () => "next", busy), "next");
});
