const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { openWhatsAppDraft, ShareChannelError, shareChannelError } = require('../apps/mobile/src/lib/shareChannel.ts');
const message = { subject: 'JUNTO', body: 'Únete a Cine · no es un cobro' };

test('native WhatsApp directly opens an encoded draft without a package-visibility preflight', async () => {
  let draft;
  await openWhatsAppDraft(message, { web: false, openURL: async url => { draft = new URL(url); } }, '999888777');
  assert.equal(draft.protocol, 'whatsapp:');
  assert.equal(draft.searchParams.get('phone'), '51999888777');
  assert.equal(draft.searchParams.get('text'), message.body);
  assert.equal(draft.searchParams.has('send'), false);
});
test('missing WhatsApp keeps an actionable alternative, never mislabels the invitation link', async () => {
  await assert.rejects(openWhatsAppDraft(message, { web: false, openURL: async () => { throw new Error('No Activity found android secret'); } }), error => {
    assert.ok(error instanceof ShareChannelError);
    assert.match(shareChannelError(error, 'fallback'), /instalado.*copiar.*correo/);
    assert.doesNotMatch(error.message, /Activity|secret|preparar el enlace/);
    return true;
  });
  assert.equal(shareChannelError(new Error('SQL secret'), 'safe'), 'safe');
});
test('an external opener that never responds releases the UI after a bounded wait', async () => {
  await assert.rejects(openWhatsAppDraft(message, { web: false, openURL: () => new Promise(() => {}) }, '', 10), /WhatsApp no respondió.*no enviamos/);
});
test('a late rejection after timeout is handled, not an unhandled promise rejection', async () => {
  let reject;
  await assert.rejects(openWhatsAppDraft(message, { web: false, openURL: () => new Promise((_, r) => { reject = r; }) }, '', 10), ShareChannelError);
  reject(new Error('late native rejection'));
  await new Promise(resolve => setImmediate(resolve));
});
test('web preserves the exact explicit recipient and invalid numbers never reach an opener', async () => {
  let calls = 0;
  await openWhatsAppDraft(message, { web: true, openURL: async url => { calls++; assert.equal(new URL(url).pathname, '/51999888777'); } }, '+51 999888777');
  await assert.rejects(openWhatsAppDraft(message, { web: true, openURL: async () => { calls++; } }, '999888777&send=true'));
  assert.equal(calls, 1);
});
test('sharing sheet switches mail/image content in its existing native window', () => {
  const source = fs.readFileSync('apps/mobile/src/components/ui/ShareMessage.tsx', 'utf8');
  const sheet = source.slice(source.indexOf('export function ShareMessageSheet'));
  assert.match(sheet, /if \(!message\) return null/);
  assert.equal((sheet.match(/<Modal\b/g) || []).length, 1);
  assert.match(sheet, /renderContent=/);
  assert.match(source, /if \(renderContent\) return renderContent/);
  assert.doesNotMatch(source, /Linking\.canOpenURL/);
});
