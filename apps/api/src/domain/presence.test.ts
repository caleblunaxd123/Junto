import test from "node:test";
import assert from "node:assert/strict";
import { isOnline, shouldRecord, ONLINE_WINDOW_MS, PRESENCE_WRITE_EVERY_MS } from "./presence";

test("online means activity within the last minute", () => {
  const now = new Date("2026-10-16T15:00:00Z");
  assert.equal(isOnline(null, now), false);
  assert.equal(isOnline(new Date(now.getTime() - ONLINE_WINDOW_MS), now), true);
  assert.equal(isOnline(new Date(now.getTime() - ONLINE_WINDOW_MS - 1), now), false);
});

test("last-seen writes are throttled per person", () => {
  const writes = new Map<string, number>();
  assert.equal(shouldRecord(writes, "ana", 0), true);
  assert.equal(shouldRecord(writes, "ana", PRESENCE_WRITE_EVERY_MS - 1), false);
  assert.equal(shouldRecord(writes, "luis", 10), true);
  assert.equal(shouldRecord(writes, "ana", PRESENCE_WRITE_EVERY_MS), true);
});
