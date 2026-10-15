// LOCAL QA: the receiver attaches the payer's screenshot when recording money already received.
// Fictional accounts; a fictional voucher made per run by ops/create-voucher-fixture.py; loopback API only.
// Usage: DATABASE_URL=<local QA db> JWT_SECRET=<fictional> node ops/test-received-voucher.cjs  (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { execFileSync } = require('node:child_process');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
const PORT = 3047;

async function run() {
  const server = helpers.startApi(PORT, {});
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body, status) {
      const response = await fetch(`http://127.0.0.1:${PORT}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json().catch(() => null);
      if (status) assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      else assert.ok(response.ok, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function account(nombre, slug) {
      const email = `qa-rv-${slug}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre, email, password: `Received${suffix}!` });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return call('/auth/verify-email', null, 'POST', { email, otp: otpCode });
    }
    const sofia = await account('Sofía QA', 'sofia');
    const luis = await account('Luis QA', 'luis');
    const outsider = await account('Fuera QA', 'fuera');
    const group = await call('/grupos', sofia, 'POST', { nombre: `Captura recibida ${suffix}`, tipo: 'amigos' });
    await call('/grupos/unirse', luis, 'POST', { link: group.linkInvitacion });
    await call('/grupos/unirse', outsider, 'POST', { link: group.linkInvitacion });
    const detail = await call(`/grupos/${group.id}`, sofia);
    await call(`/grupos/${group.id}/gastos`, sofia, 'POST', { descripcion: 'Pizza', montoTotal: 6000, pagadoPor: sofia.usuario.id, tipoDivision: 'exacto', categoria: 'comida', participantes: [{ usuarioId: sofia.usuario.id, monto: 2000 }, { usuarioId: luis.usuario.id, monto: 4000 }] });
    assert.ok(detail.miembros.length === 3);

    // Sofía uploads the screenshot Luis sent her and records the payment as received.
    // A new fictional screenshot each run (random operation number): earlier runs never make it a duplicate.
    const file = path.join(os.tmpdir(), `junto-qa-received-${suffix}.png`);
    const operacion = String(10_000_000 + Math.floor(Math.random() * 89_999_999));
    execFileSync('python', [path.join(__dirname, 'create-voucher-fixture.py'), '--operacion', operacion, '--monto', '40', '--destinatario', 'Sofía Q. Prueba', '--salida', file]);
    const imagen = fs.readFileSync(file).toString('base64');
    fs.rmSync(file, { force: true });
    const draft = await call('/pagos/comprobantes', sofia, 'POST', { grupoId: group.id, imagen });
    assert.ok(draft.comprobanteId);
    // Nobody else can attach Sofía's draft (not even Luis, the payer).
    await call('/pagos/recibido', outsider, 'POST', { grupoId: group.id, pagadorId: luis.usuario.id, monto: 1000, metodo: 'yape', comprobanteId: draft.comprobanteId }, 400);
    const pago = await call('/pagos/recibido', sofia, 'POST', { grupoId: group.id, pagadorId: luis.usuario.id, monto: 4000, metodo: 'yape', comprobanteId: draft.comprobanteId });
    assert.equal(pago.estado, 'exitoso');
    const stored = await db.comprobante.findUniqueOrThrow({ where: { id: draft.comprobanteId } });
    assert.equal(stored.pagoId, pago.id, 'the screenshot is linked to the recorded payment');

    // Payer and receiver see it; a third member does not.
    for (const viewer of [sofia, luis]) {
      const response = await fetch(`http://127.0.0.1:${PORT}/api/pagos/${pago.id}/comprobante`, { headers: { Authorization: `Bearer ${viewer.accessToken}` } });
      assert.equal(response.status, 200, 'involved people can open the screenshot');
    }
    const blocked = await fetch(`http://127.0.0.1:${PORT}/api/pagos/${pago.id}/comprobante`, { headers: { Authorization: `Bearer ${outsider.accessToken}` } });
    assert.equal(blocked.status, 404, 'someone else in the group cannot see it');

    // The notebook marks the payment as having a screenshot.
    const statement = await call(`/grupos/${group.id}/estado-cuenta`, sofia);
    const row = statement.movimientos.find((m) => m.id === pago.id);
    assert.ok(row && row.conComprobante, 'notebook shows the attachment');

    // The same screenshot cannot back a second payment, and a used draft cannot be attached again.
    await call(`/grupos/${group.id}/gastos`, sofia, 'POST', { descripcion: 'Taxi', montoTotal: 2000, pagadoPor: sofia.usuario.id, tipoDivision: 'exacto', categoria: 'transporte', participantes: [{ usuarioId: luis.usuario.id, monto: 2000 }] });
    await call('/pagos/recibido', sofia, 'POST', { grupoId: group.id, pagadorId: luis.usuario.id, monto: 1000, metodo: 'yape', comprobanteId: draft.comprobanteId }, 409);
    const again = await call('/pagos/comprobantes', sofia, 'POST', { grupoId: group.id, imagen });
    assert.ok(again.duplicado, 'uploading the same image again warns that it is already used');
    await call('/pagos/recibido', sofia, 'POST', { grupoId: group.id, pagadorId: luis.usuario.id, monto: 1000, metodo: 'yape', comprobanteId: again.comprobanteId }, 409);
    // Cash needs no screenshot.
    await call('/pagos/recibido', sofia, 'POST', { grupoId: group.id, pagadorId: luis.usuario.id, monto: 1000, metodo: 'efectivo' });
    console.log('PASS: receiver attaches the payer\'s screenshot when recording a received payment; linked, visible only to payer/receiver, shown in the notebook; other people cannot use the draft; the same image cannot back a second payment; cash needs none. Local data only.');
  } catch (error) {
    console.error(server.log().split(String.fromCharCode(10)).filter((line) => /error/i.test(line)).slice(-8).join(String.fromCharCode(10)));
    throw error;
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
