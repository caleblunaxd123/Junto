import test from 'node:test';
import assert from 'node:assert/strict';
import { serverConfig } from './serverConfig';

const production = { NODE_ENV: 'production', JWT_SECRET: 'fictional-test-key-0123456789abcdef', FRONTEND_URL: 'https://junto.example.org' };
test('production requires an exact HTTPS origin and a non-placeholder signing key', () => {
  assert.deepEqual(serverConfig({ ...production, FRONTEND_URL: 'https://junto.example.org, https://app.example.org:8443' }).allowedOrigins, ['https://junto.example.org', 'https://app.example.org:8443']);
  for (const value of ['', 'http://junto.example.org', 'https://', 'https://*.example.org', 'https://junto.example.org/app', 'https://junto.example.org/', 'https://user:pass@junto.example.org', 'https://junto.example.org?origin=trusted', 'https://junto.example.org#trusted'])
    assert.throws(() => serverConfig({ ...production, FRONTEND_URL: value }), /FRONTEND_URL/);
  for (const secret of ['', 'short', 'cambia_esto_0123456789abcdef0123456789'])
    assert.throws(() => serverConfig({ ...production, JWT_SECRET: secret }), /JWT_SECRET/);
  assert.deepEqual(serverConfig({ NODE_ENV: 'test' }).allowedOrigins, []);
});
