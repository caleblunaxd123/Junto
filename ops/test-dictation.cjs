const { test } = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { createDictation } = require('../apps/mobile/src/lib/dictation.ts');
function fixture(overrides = {}, duration = 1000, finishWait = 1000) {
  const states = [], texts = [], errors = []; let events, starts = 0, aborts = 0, removes = 0;
  const driver = { available: () => true, permission: async () => true,
    listen: e => { events = e; return () => removes++; },
    start: () => { starts++; events.start(); }, stop: () => {}, abort: () => aborts++, ...overrides };
  const session = createDictation(driver, { state: s => states.push(s), text: s => texts.push(s), error: s => errors.push(s) }, duration, finishWait);
  return { session, states, texts, errors, events: () => events, starts: () => starts, aborts: () => aborts, removes: () => removes };
}
test('permission is requested only on start; rejection leaves manual entry usable', async () => {
  let asked = 0; const f = fixture({ permission: async () => { asked++; return false; } });
  assert.equal(asked, 0); await f.session.start(); assert.equal(asked, 1); assert.equal(f.starts(), 0);
  assert.match(f.errors.at(-1), /permiso/); assert.equal(f.states.at(-1), 'idle');
});
test('cancelling a pending permission never starts the mic or edits a later form', async () => {
  let allow; const f = fixture({ permission: () => new Promise(r => allow = r) });
  const p = f.session.start(); f.session.cancel(); allow(true); await p;
  assert.equal(f.starts(), 0); assert.deepEqual(f.texts, []);
});
test('double taps, stop, final result, cancellation and stale callbacks are safe', async () => {
  const f = fixture(); await Promise.all([f.session.start(), f.session.start()]); assert.equal(f.starts(), 1);
  const old = f.events(); old.result('Pagué 120 soles'); f.session.stop(); old.result('Pagué 120 soles por la cena'); old.end();
  assert.equal(f.states.at(-1), 'idle'); assert.equal(f.texts.at(-1), 'Pagué 120 soles por la cena');
  await f.session.start(); f.session.cancel(); old.result('stale'); f.events().result('stale');
  assert.equal(f.texts.at(-1), 'Pagué 120 soles por la cena'); assert.equal(f.removes(), 2);
});
test('unavailable service, silence and network errors return to idle without saving', async () => {
  const missing = fixture({ available: () => false }); await missing.session.start(); assert.equal(missing.starts(), 0);
  assert.match(missing.errors.at(-1), /no está disponible/);
  const f = fixture(); await f.session.start(); f.events().result('Pagué'); f.events().error('network');
  assert.equal(f.states.at(-1), 'idle'); assert.equal(f.texts.at(-1), 'Pagué'); assert.match(f.errors.at(-1), /conexión/);
});
test('hard timeout and missing end callback do not keep the microphone active', async () => {
  const f = fixture({}, 5, 5); await f.session.start(); await new Promise(r => setTimeout(r, 40));
  assert.equal(f.states.at(-1), 'idle'); assert.equal(f.aborts(), 1);
});
test('transcripts have a bounded Unicode-safe size', async () => {
  const f = fixture(); await f.session.start(); f.events().result('💚'.repeat(600));
  assert.equal(Array.from(f.texts[0]).length, 500); f.session.cancel();
});

test('a service that never starts fails promptly and remains retryable', async () => {
  const states = [], errors = []; let aborts = 0;
  const session = createDictation({ available: () => true, permission: async () => true, listen: () => () => {}, start: () => {}, stop: () => {}, abort: () => aborts++ },
    { state: value => states.push(value), text: () => assert.fail('no transcript expected'), error: value => errors.push(value) }, 1000, 1000, 5);
  await session.start(); await new Promise(resolve => setTimeout(resolve, 30));
  assert.equal(states.at(-1), 'idle'); assert.match(errors.at(-1), /no respondió/); assert.equal(aborts, 1);
  session.cancel();
});

test('Spanish locale selection handles Samsung/service locale differences without English fallback', () => {
  const { speechLocale } = require('../apps/mobile/src/lib/speechLocale.ts');
  assert.equal(speechLocale(['en-US', 'es-ES']), 'es-ES');
  assert.equal(speechLocale(['es_ES', 'es_PE']), 'es-PE');
  assert.equal(speechLocale(['es-CO']), 'es-CO');
  assert.equal(speechLocale([]), 'es-PE');
});
test('updating an old APK removes only its stale microphone removal marker', () => {
  const { enableDictationPermission } = require('../apps/mobile/plugins/withDictationPermission');
  const manifest = { 'uses-permission': [ { $: { 'android:name': 'android.permission.RECORD_AUDIO', 'tools:node': 'remove' } }, { $: { 'android:name': 'android.permission.WRITE_CONTACTS', 'tools:node': 'remove' } } ] };
  enableDictationPermission(manifest); enableDictationPermission(manifest);
  assert.equal(manifest['uses-permission'].length, 2);
  assert.equal(manifest['uses-permission'][0].$['tools:node'], undefined);
  assert.equal(manifest['uses-permission'][1].$['tools:node'], 'remove');
});
test('a session that ends without hearing anything says so instead of looking like a dead mic', async () => {
  const f = fixture(); await f.session.start(); f.events().end();
  assert.equal(f.states.at(-1), 'idle'); assert.match(f.errors.at(-1), /No escuchamos/);
  const heard = fixture(); await heard.session.start(); heard.events().result('Pagué 30 soles'); heard.events().end();
  assert.equal(heard.errors.filter(Boolean).length, 0);
});
