import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleNonceMatches } from './googleNonce';
test('Google browser nonce binds the verified response; native tokens remain compatible', () => {
  const nonce = 'a'.repeat(64);
  assert.equal(googleNonceMatches(nonce, nonce), true);
  assert.equal(googleNonceMatches(undefined, nonce), false);
  assert.equal(googleNonceMatches('b'.repeat(64), nonce), false);
  assert.equal(googleNonceMatches(undefined), true);
});
