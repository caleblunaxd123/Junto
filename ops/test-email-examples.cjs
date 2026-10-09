const {test} = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({transpileOnly: true, compilerOptions: {module: 'CommonJS', moduleResolution: 'node'}});
const {renderAccountEmail} = require('../apps/api/src/domain/accountEmail.ts');
const share = require('../packages/shared/share.js');
const {buildExamples, parseRecipients, notice} = require('./contabo/send-all-email-tests.cjs');

test('Six real templates, safe fictitious codes, clear notice, separate authorized recipients', () => {
  assert.deepEqual(parseRecipients(['--to=a@example.invalid', '--to=b@example.invalid'], share.validShareEmail), ['a@example.invalid', 'b@example.invalid']);
  assert.throws(() => parseRecipients(['--to=a@example.invalid', '--to=a@example.invalid'], share.validShareEmail));
  assert.throws(() => parseRecipients(['--to=a@example.invalid\r\nBcc: x@example.invalid'], share.validShareEmail));
  assert.throws(() => parseRecipients(['--to=a@example.invalid', '--to=b@example.invalid', '--to=c@example.invalid'], share.validShareEmail));
  const examples = buildExamples(renderAccountEmail, share, 'https://junto.lunalav.pe', '2026-10-09T00-00-00-000Z');
  assert.equal(examples.length, 6);
  assert.equal(new Set(examples.map(m => m.kind)).size, 6);
  for (const message of examples) {
    assert.match(message.subject, /^PRUEBA JUNTO/);
    assert.doesNotMatch(message.subject, /000000/);
    assert.ok(message.text.startsWith(notice));
    assert.ok(message.html.includes(notice));
    assert.doesNotMatch(message.html, /<(?:script|iframe|img)\b/i);
  }
  const account = examples.filter(m => ['verification', 'reset'].includes(m.kind));
  for (const message of account) assert.match(message.text, /000000/);
  const quick = examples.find(m => m.kind === 'cuenta_rapida');
  assert.match(quick.html, /S\/ 33\.34/);
  assert.match(quick.html, /S\/ 33\.33/);
  const group = examples.find(m => m.kind === 'grupo');
  assert.match(group.html, /Todavía no descuentan la deuda/);
  assert.match(group.html, /Quién paga a quién/);
  assert.match(examples.find(m => m.kind === 'gasto').html, /no las deudas pendientes/);
});
