// Local QA only: exercise account endpoints against a loopback SMTP capture, not Gmail.
// Requires a migrated local QA DATABASE_URL; run after npm run build:api.
const assert = require('node:assert/strict');
const net = require('node:net');
const path = require('node:path');
const {spawn} = require('node:child_process');
const {PrismaClient} = require('@prisma/client');
require('./local-qa.cjs').localQa();
const db = new PrismaClient();
const inbox = [], sockets = new Set();
let rejectMail = false;
const decode = raw => Buffer.from(raw.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g,
  (_, hex) => String.fromCharCode(parseInt(hex, 16))), 'latin1').toString('utf8');
const server = net.createServer(socket => {
  sockets.add(socket); socket.on('close', () => sockets.delete(socket));
  socket.setEncoding('utf8'); socket.write('220 local QA SMTP\r\n');
  let buffer = '', data = false, lines = [];
  socket.on('data', chunk => {
    buffer += chunk;
    while (buffer.includes('\r\n')) {
      const end = buffer.indexOf('\r\n'), line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
      if (data) {
        if (line === '.') {
          data = false;
          if (rejectMail) socket.write('550 QA simulated provider rejection\r\n');
          else { inbox.push(decode(lines.join('\r\n'))); socket.write('250 QA accepted\r\n'); }
          lines = [];
        } else lines.push(line.replace(/^\.\./, '.'));
      } else if (/^EHLO|^HELO/.test(line)) socket.write('250-localhost\r\n250 AUTH PLAIN\r\n');
      else if (/^AUTH/.test(line)) socket.write('235 ok\r\n');
      else if (/^DATA/.test(line)) { data = true; socket.write('354 go\r\n'); }
      else if (/^QUIT/.test(line)) socket.end('221 bye\r\n');
      else socket.write('250 ok\r\n');
    }
  });
});
const waitFor = async predicate => {
  for (let i = 0; i < 80; i++) { if (await predicate()) return; await new Promise(r => setTimeout(r, 100)); }
  throw new Error('QA deadline exceeded');
};
const origin = 'http://127.0.0.1:3027';
async function call(route, body, status = 200, token) {
  const response = await fetch(origin + '/api' + route, {method: body ? 'POST' : 'GET',
    headers: {'Content-Type': 'application/json', ...(token ? {Authorization: `Bearer ${token}`} : {})},
    body: body ? JSON.stringify(body) : undefined});
  const result = await response.json();
  assert.equal(response.status, status, route);
  return result;
}
async function run() {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const api = spawn(process.execPath, [path.join(__dirname, '../apps/api/dist/index.js')], {
    env: {...process.env, PORT: '3027', NODE_ENV: 'test', RESEND_API_KEY: '',
      SMTP_HOST: '127.0.0.1', SMTP_PORT: String(server.address().port), SMTP_USER: 'qa@example.invalid',
      SMTP_PASS: 'fictional-only', SMTP_ALLOW_INSECURE_LOCAL: 'true', EMAIL_FROM: 'JUNTO <qa@example.invalid>',
      PUBLIC_WEB_URL: 'https://junto.example', GOOGLE_CLIENT_IDS: '', EMAIL_DEV_LOG: ''},
    stdio: ['ignore', 'pipe', 'pipe']});
  let logs = '';
  api.stdout.on('data', chunk => { logs += chunk; }); api.stderr.on('data', chunk => { logs += chunk; });
  const suffix = Date.now(), email = `qa-account-mail-${suffix}@example.invalid`;
  const password = `InitialQA${suffix}!`, newPassword = `ChangedQA${suffix}!`;
  const readUser = () => db.usuario.findUniqueOrThrow({where: {email}});
  const ageCode = () => db.usuario.update({where: {email}, data: {otpExpires: new Date(Date.now() + 13 * 60000)}});
  try {
    await waitFor(async () => { try { return (await fetch(origin + '/ready')).ok; } catch { return false; } });
    const registration = await call('/auth/register', {email, nombre: 'Cuenta QA <script>', password}, 201);
    assert.equal(registration.verificationRequired, true); assert.equal(registration.emailDelivery, true);
    assert.equal(registration.accessToken, undefined); assert.equal(registration.usuario.otpCode, undefined);
    await waitFor(() => inbox.length === 1);
    const original = await readUser();
    assert.ok(inbox[0].includes(original.otpCode)); assert.ok(inbox[0].includes('&lt;script&gt;'));
    await call('/auth/login', {email, password}, 403);
    await call('/auth/resend-verification', {email}, 400);
    assert.equal(inbox.length, 1, 'cooldown does not send again');
    await ageCode(); await call('/auth/resend-verification', {email});
    await waitFor(() => inbox.length === 2);
    const second = await readUser(); assert.ok(inbox[1].includes(second.otpCode));
    await call('/auth/verify-email', {email, otp: '000000'}, 400);
    assert.equal((await readUser()).otpAttempts, 1);
    const session = await call('/auth/verify-email', {email, otp: second.otpCode});
    await waitFor(() => inbox.length === 3);
    assert.ok(inbox[2].includes('Tu cuenta está lista'));
    assert.equal((await readUser()).otpCode, null);
    await call('/auth/verify-email', {email, otp: second.otpCode}, 400);
    await call('/auth/resend-verification', {email});
    assert.equal(inbox.length, 3, 'verified account gets no redundant OTP/welcome');
    const forgot = await call('/auth/forgot-password', {email});
    await waitFor(() => inbox.length === 4);
    const reset = await readUser(); assert.ok(inbox[3].includes(reset.otpCode));
    assert.equal(reset.otpPurpose, 'reset');
    assert.deepEqual(await call('/auth/forgot-password', {email: `absent-${suffix}@example.invalid`}), forgot,
      'same public response does not disclose account existence');
    await call('/auth/forgot-password', {email}); assert.equal(inbox.length, 4);
    // A password-reset code must not work as an email-verification code.
    await call('/auth/verify-email', {email, otp: reset.otpCode}, 400);
    await db.usuario.update({where: {email}, data: {otpExpires: new Date(Date.now() - 1000)}});
    await call('/auth/reset-password', {email, otp: reset.otpCode, newPassword}, 400);
    await call('/auth/forgot-password', {email});
    await waitFor(() => inbox.length === 5);
    const renewed = await readUser(); assert.ok(inbox[4].includes(renewed.otpCode));
    await call('/auth/reset-password', {email, otp: renewed.otpCode, newPassword});
    await call('/auth/reset-password', {email, otp: renewed.otpCode, newPassword}, 400);
    await call('/auth/me', undefined, 401, session.accessToken);
    await call('/auth/refresh', {refreshToken: session.refreshToken}, 401);
    await call('/auth/login', {email, password}, 401);
    await call('/auth/login', {email, password: newPassword});
    assert.equal((await readUser()).otpCode, null);
    await call('/auth/forgot-password', {email}); await waitFor(() => inbox.length === 6);
    const blocked = await readUser();
    for (let i = 0; i < 5; i++) await call('/auth/reset-password', {email, otp: '000000', newPassword}, 400);
    await call('/auth/reset-password', {email, otp: blocked.otpCode, newPassword}, 400);
    assert.equal((await readUser()).otpAttempts, 5);
    // Provider rejection must not produce a verified account or a successful delivery claim.
    rejectMail = true;
    const rejectedEmail = `qa-account-mail-rejected-${suffix}@example.invalid`;
    const rejected = await call('/auth/register', {email: rejectedEmail, nombre: 'Proveedor rechazado QA', password}, 201);
    assert.equal(rejected.emailDelivery, false); assert.equal(rejected.usuario.emailVerificado, false);
    await db.usuario.update({where: {email: rejectedEmail}, data: {otpExpires: new Date(Date.now() + 13 * 60000)}});
    await call('/auth/resend-verification', {email: rejectedEmail}, 503);
    assert.equal(inbox.length, 6);
    for (const raw of inbox) {
      const code = raw.match(/Tu código es (\d{6})/)?.[1] || raw.match(/\b[1-9]\d{5}\b/)?.[0];
      if (code) assert.ok(!logs.includes(code), 'OTP not logged');
    }
    console.log('Account e-mail API QA passed: registration, resend, welcome, reset, expiry, reuse, attempts, revocation, provider rejection. No external mail.');
  } finally {
    api.kill(); for (const socket of sockets) socket.destroy();
    await new Promise(resolve => server.close(resolve));
  }
}
run().finally(() => db.$disconnect()).catch(() => { console.error('Account e-mail QA failed; inspect the assertions locally without logging OTPs or tokens.'); process.exitCode = 1; });
