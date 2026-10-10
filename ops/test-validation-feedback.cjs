const {test} = require('node:test');
const assert = require('node:assert/strict');
require('ts-node').register({transpileOnly: true, compilerOptions: {module: 'CommonJS', moduleResolution: 'node'}});
const {errorMessage, feedbackTitle} = require('../apps/mobile/src/lib/errorMessage.ts');
const auth = require('../apps/mobile/src/lib/authValidation.ts');
const {createDialogQueue} = require('../apps/mobile/src/lib/dialogQueue.ts');

test('Actionable field details, clean fallbacks and no technical/HTML error leakage', () => {
  assert.equal(errorMessage({response: {status: 400, data: {error: 'Datos inválidos', details: [{label: 'Correo', message: 'Escribe un correo válido.'}]}}}), 'Correo: Escribe un correo válido.');
  assert.equal(errorMessage({response: {status: 500, data: {error: 'Prisma SQLSTATE secret'}}}, 'Comprueba si se guardó.'), 'Comprueba si se guardó.');
  assert.equal(errorMessage({response: {status: 502, data: '<html>Bad Gateway</html>'}}, 'Revisa tu conexión.'), 'Revisa tu conexión.');
  assert.equal(errorMessage(new Error('Network Error'), 'No sabemos si se guardó.'), 'No sabemos si se guardó.');
  assert.equal(errorMessage({response: {status: 429, headers: {'retry-after': '61'}}}), 'Has hecho varios intentos seguidos. Espera 2 minutos y vuelve a intentar.');
  assert.match(errorMessage({response: {status: 429, headers: {'retry-after': 'oops'}}}), /unos minutos/);
  assert.match(errorMessage({response: {status: 401}}), /sesión terminó/);
  assert.equal(errorMessage({response: {status: 503, data: {code: 'EMAIL_DELIVERY_FAILED', error: 'Tu cuenta sigue protegida. Reenvía en un minuto.'}}}), 'Tu cuenta sigue protegida. Reenvía en un minuto.');
  assert.equal(feedbackTitle('No sabemos si se guardó.'), 'Revisa el resultado antes de repetir');
  assert.equal(feedbackTitle('Comprueba tu conexión.'), 'No pudimos conectarnos');
});
test('Authentication fields explain the exact correction instead of a disabled silent form', () => {
  for (const bad of ['', ' x ', 'a..b@example.com', 'a@example.com\r\nBcc: b@example.com']) assert.ok(auth.emailError(bad));
  assert.equal(auth.emailError('  qa@example.invalid  '), '');
  assert.equal(auth.emailError('cuenta.ficticia@gmail.com'), '');
  assert.equal(auth.emailError('cuenta.ficticia@outlook.com'), '');
  assert.ok(auth.nameError(' ')); assert.equal(auth.nameError('Ana'), '');
  assert.ok(auth.passwordError('1234')); assert.ok(auth.passwordError('longpassword')); assert.equal(auth.passwordError('password1'), '');
  assert.equal(auth.phoneError(''), ''); assert.ok(auth.phoneError('123456789')); assert.equal(auth.phoneError('987654321'), '');
  assert.ok(auth.codeError('12345')); assert.equal(auth.codeError('123456'), '');
  assert.ok(auth.confirmationError('password1', 'password2'));
});
test('Dialogs preserve the safe business reason and never silently swallow failed actions', async () => {
  const q = createDialogQueue();
  q.alert('Guardar', '', [{text: 'Guardar', onPress: async () => {throw {response: {status: 409, data: {error: 'El aporte cambió. Actualiza antes de confirmar.'}}};}}]);
  await q.choose(q.getSnapshot().id, 0);
  assert.equal(q.getSnapshot().message, 'El aporte cambió. Actualiza antes de confirmar.');
  assert.equal(q.getSnapshot().tone, 'warning');
});
