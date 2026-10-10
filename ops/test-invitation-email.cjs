const { test } = require('node:test');
const assert = require('node:assert/strict');
const { invitationShareMessage, shareEmailHtml, shareEmailText, shareFingerprint } = require('../packages/shared/share');
test('invitation is a reviewed link, not a financial report or automatic membership', () => {
  const message = invitationShareMessage('Viaje a Cartagena', 'https://junto.example.invalid/unirse/AbCd1234');
  const html = shareEmailHtml(message, { sentBy: 'Ana' });
  assert.match(html, /Ver invitación/);
  assert.match(html, /No entras al grupo hasta que lo aceptes/);
  assert.match(shareEmailText(message), /Abre el enlace, crea tu cuenta/);
  assert.equal(message.preview, undefined);
  assert.match(shareFingerprint(message), /^[a-f0-9]{16}$/);
});
test('invitation names are escaped and links cannot contain scripts or credentials', () => {
  const html = shareEmailHtml(invitationShareMessage('<img onerror=x>', 'https://junto.example.invalid/unirse/AbCd1234'));
  assert.match(html, /&lt;img onerror=x&gt;/);
  assert.doesNotMatch(html, /<img|<script|onclick=/);
  for (const url of ['javascript:alert(1)', 'http://junto.example.invalid/unirse/AbCd1234', 'https://u:p@junto.example.invalid/unirse/AbCd1234', 'https://junto.example.invalid/unirse/AbCd1234?next=evil', 'https://junto.example.invalid/other'])
    assert.throws(() => invitationShareMessage('Viaje', url));
});
