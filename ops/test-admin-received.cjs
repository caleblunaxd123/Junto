// Fictional local ledger only; no SMTP, push tokens, friends or production requests.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3038, {});
  try {
    await server.ready;
    async function user(nombre) {
      const p = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: p.id, token: jwt.sign({ userId: p.id, email: p.email, credentialsTag: credentialsTag(p.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const owner = await user('Admin QA'); const member = await user('Miembro QA'); const outside = await user('Otro QA');
    async function request(route, actor, method = 'GET', body) {
      const r = await fetch('http://127.0.0.1:3038/api' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${actor.token}` }, body: body ? JSON.stringify(body) : undefined });
      return { status: r.status, data: r.status === 204 ? null : await r.json() };
    }
    async function call(route, actor, method, body, status = 200) {
      const r = await request(route, actor, method, body); assert.equal(r.status, status, JSON.stringify(r.data)); return r.data;
    }
    const group = await call('/grupos', owner, 'POST', { nombre: 'Pagos entre nombres QA', integrantes: ['Ana', 'Luis'] }, 201);
    let g = await call(`/grupos/${group.id}`, owner);
    const ana = g.miembros.find((m) => m.usuario.nombre === 'Ana').usuarioId;
    const luis = g.miembros.find((m) => m.usuario.nombre === 'Luis').usuarioId;
    await call('/grupos/unirse', member, 'POST', { link: group.linkInvitacion });
    await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Ana adelantó', montoTotal: 30000, pagadoPor: ana, participantes: [owner.id, luis, member.id].map((usuarioId) => ({ usuarioId })) }, 201);
    const input = { grupoId: group.id, pagadorId: luis, receptorId: ana, monto: 2000, metodo: 'efectivo' };
    await call('/pagos/recibido', member, 'POST', input, 403);
    await call('/pagos/recibido', outside, 'POST', input, 400);
    await call('/pagos/recibido', owner, 'POST', { ...input, pagadorId: owner.id }, 403);
    await call('/pagos/recibido', owner, 'POST', { ...input, receptorId: member.id }, 403);
    await call('/pagos/recibido', owner, 'POST', { ...input, monto: 10001 }, 400);
    const paid = await call('/pagos/recibido', owner, 'POST', input, 201);
    assert.equal(paid.estado, 'exitoso'); assert.equal(paid.receptorId, ana); assert.equal(paid.resueltoPor, owner.id);
    g = await call(`/grupos/${group.id}`, owner);
    assert.equal(g.resumen.cuentas.find((a) => a.usuarioId === ana).neto, 28000);
    assert.equal(g.resumen.cuentas.find((a) => a.usuarioId === luis).neto, -8000);
    assert.equal(g.resumen.totalGastado, 30000);
    const races = await Promise.all([1, 2].map(() => request('/pagos/recibido', owner, 'POST', { ...input, monto: 8000 })));
    assert.deepEqual(races.map((r) => r.status).sort(), [201, 400]);
    // The name becomes a real account while the same receiver ID used to be valid.
    const realAna = await user('Ana real QA');
    const personal = g.miembros.find((m) => m.usuarioId === ana).codigoPersonal;
    await call('/grupos/unirse', realAna, 'POST', { link: personal });
    await call('/pagos/recibido', owner, 'POST', { ...input, pagadorId: member.id, receptorId: realAna.id }, 403);
    const received = await call('/pagos/recibido', realAna, 'POST', { ...input, pagadorId: member.id, receptorId: realAna.id }, 201);
    assert.equal(received.resueltoPor, realAna.id);
    assert.equal((await call(`/grupos/${group.id}`, owner)).resumen.totalGastado, 30000);
    console.log('PASS: admin records for name-only receiver; exact partial/full balances, concurrency, no self-approval, non-admin/outside/real-account refusal, and receiver takeover.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
