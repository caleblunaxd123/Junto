import { test } from 'node:test';
import assert from 'node:assert/strict';
import { passwordBytes, passwordWithinLimit } from '@junto/shared/password';
import { registerSchema, resetPasswordSchema, loginSchema } from '../schemas/auth.schema';

test('new credentials reject bcrypt truncation consistently, including Unicode', () => {
  const samples = ['a'.repeat(71) + '1', 'á'.repeat(35) + 'a1', '🔐'.repeat(17) + 'abc1', '\ud800abc1234'];
  for (const password of samples) {
    assert.equal(passwordBytes(password), Buffer.byteLength(password));
    assert.ok(passwordWithinLimit(password));
    assert.ok(registerSchema.safeParse({ nombre: 'Ana QA', email: 'ana@example.invalid', password }).success);
    assert.ok(resetPasswordSchema.safeParse({ email: 'ana@example.invalid', otp: '123456', newPassword: password }).success);
  }
  for (const password of ['a'.repeat(72) + '1', 'á'.repeat(36) + '1', '🔐'.repeat(18) + '1']) {
    assert.equal(passwordBytes(password), Buffer.byteLength(password));
    assert.equal(registerSchema.safeParse({ nombre: 'Ana QA', email: 'ana@example.invalid', password }).success, false);
    assert.equal(resetPasswordSchema.safeParse({ email: 'ana@example.invalid', otp: '123456', newPassword: password }).success, false);
    // Existing credentials remain usable; only newly created passwords get the limit.
    assert.ok(loginSchema.safeParse({ email: 'ana@example.invalid', password }).success);
  }
});
