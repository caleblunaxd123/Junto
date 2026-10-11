// Fictional loopback ledger only: no external mail, push tokens, AI calls or live accounts.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3039, {});
  try {
    await server.ready;
    async function user(nombre) {
      const u = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: u.id, email: u.email, token: jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const owner = await user('Moneda QA'); const payer = await user('Pago QA'); const invited = await user('Invitado QA');
    async function request(route, actor, method = 'GET', body, capable = true) {
      const r = await fetch('http://127.0.0.1:3039/api' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor.token}`, ...(capable ? { 'X-Junto-Currency-Version': '1' } : {}) }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: r.status === 204 ? null : await r.json() };
    }
    async function call(route, actor, method, body, status = 200, capable = true) {
      const r = await request(route, actor, method, body, capable); assert.equal(r.status, status, JSON.stringify(r.data)); return r.data;
    }
    const pen = await call('/grupos', owner, 'POST', { nombre: 'Soles QA' }, 201);
    assert.equal(pen.moneda, 'PEN'); assert.equal(pen.pais, null);
    for (const moneda of ['USD', 'EUR', 'MXN', 'BRL']) {
      const g = await call('/grupos', owner, 'POST', { nombre: `Colombia ${moneda} QA`, pais: 'CO', moneda }, 201);
      assert.equal(g.pais, 'CO'); assert.equal(g.moneda, moneda);
    }
    await call('/grupos', owner, 'POST', { nombre: 'Inválida QA', moneda: 'XYZ' }, 400);
    const group = await call('/grupos', owner, 'POST', { nombre: 'Colombia COP QA', pais: 'CO', moneda: 'COP' }, 201);
    await call('/grupos/unirse', payer, 'POST', { link: group.linkInvitacion });
    await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Cuenta adelantada QA', montoTotal: 1000000, pagadoPor: owner.id, participantes: [{ usuarioId: owner.id }, { usuarioId: payer.id }] }, 201);
    const debt = async () => (await call(`/grupos/${group.id}`, owner)).resumen.cuentas.find((c) => c.usuarioId === payer.id).neto;
    assert.equal(await debt(), -500000);
    await call(`/grupos/${group.id}`, payer, 'GET', undefined, 426, false);
    await call(`/grupos/${group.id}`, owner, 'PUT', { moneda: 'PEN' }, 400);
    await assert.rejects(db.grupo.update({ where: { id: group.id }, data: { moneda: 'USD' } }));
    await assert.rejects(db.grupo.update({ where: { id: group.id }, data: { pais: 'PE' } }));
    const input = { grupoId: group.id, receptorId: owner.id, monto: 500000, metodo: 'transferencia', conversion: { monedaOrigen: 'USD', montoOrigen: 125, tipoCambio: '4000' } };
    await call('/pagos/reportar', payer, 'POST', { ...input, monto: 499999 }, 400);
    for (const tipoCambio of ['0', '-1', '1e3', '4000.0000001']) await call('/pagos/reportar', payer, 'POST', { ...input, conversion: { ...input.conversion, tipoCambio } }, 400);
    await call('/pagos/reportar', payer, 'POST', { ...input, conversion: { ...input.conversion, monedaOrigen: 'COP' } }, 400);
    await call('/pagos/reportar', payer, 'POST', { ...input, metodo: 'yape' }, 400);
    await call('/pagos/reportar', payer, 'POST', { ...input, conversion: undefined, monto: 500001 }, 400);
    await call('/pagos/comprobantes', payer, 'POST', { grupoId: group.id, imagen: 'not-real-image-base64' }, 400);
    await call('/ia/gastos/interpretar', owner, 'POST', { grupoId: group.id, texto: 'Pagué 5000 pesos' }, 422);
    const paid = await call('/pagos/reportar', payer, 'POST', input, 201);
    assert.equal(paid.estado, 'reportado'); assert.equal(paid.monedaOrigen, 'USD'); assert.equal(paid.montoOrigen, 125); assert.equal(paid.tipoCambio, '4000'); assert.equal(paid.grupo.moneda, 'COP');
    assert.equal(await debt(), -500000);
    await call(`/pagos/${paid.id}/confirmar`, payer, 'POST', {}, 400);
    await call(`/pagos/${paid.id}/confirmar`, owner, 'POST', {});
    assert.equal(await debt(), 0);
    const history = await call('/pagos/historial', payer);
    assert.equal(history.find((p) => p.id === paid.id).tipoCambio, '4000');
    const chat = await call(`/grupos/${group.id}/chat`, owner);
    assert.equal(chat.find((i) => i.tipo === 'pago' && i.pagoId === paid.id).monedaOrigen, 'USD');
    // A legacy APK cannot mislabel a pending foreign invitation before joining.
    await call(`/grupos/${group.id}/invitar`, owner, 'POST', { identificador: invited.email });
    await call('/invitaciones', invited, 'GET', undefined, 426, false);
    console.log('PASS: defaults, country/currency independence, immutable ledger, legacy protection, exact conversion, invalid/overflow refusal, no self-approval, pending/confirmed balances, history and chat metadata.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
