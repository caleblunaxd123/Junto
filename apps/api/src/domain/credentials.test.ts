import { test } from "node:test";
import assert from "node:assert/strict";
import { credentialsTag } from "./credentials";

test("session credential signature is deterministic and changes with password or secret", () => {
  const tag = credentialsTag("hash-original", "test-secret");
  assert.match(tag, /^[a-f0-9]{64}$/);
  assert.equal(tag, credentialsTag("hash-original", "test-secret"));
  assert.notEqual(tag, credentialsTag("hash-reset", "test-secret"));
  assert.notEqual(tag, credentialsTag("hash-original", "rotated-secret"));
});
