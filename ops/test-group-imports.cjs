// Fictional verified users, a fresh loopback QA database, no SMTP and no external notifications.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3036, { SMTP_HOST: '', SMTP_USER: '', SMTP_PASS: '', RESEND_API_KEY: '', EMAIL_DEV_LOG: 'false' });
  try {
    await server.ready;
    async function account(nombre) {
      const user = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: user.id, token: jwt.sign({ userId: user.id, email: user.email, credentialsTag: credentialsTag(user.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const owner = await account('Caleb'); const other = await account('Otro');
    async function call(route, user, method = 'GET', body, status = 200) {
      const response = await fetch('http://127.0.0.1:3036/api' + route, { method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${user.token}` }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json();
      assert.equal(response.status, status, `${route}: ${JSON.stringify(data)}`);
      return data;
    }
    const datos = { nombre: 'Cumpleaños QA', division: 'igual', totalCuenta: 50000, extras: 0, cobrarA: 'Caleb', instrucciones: 'Registro anterior de QA', participantes: ['Caleb', 'Ana', 'Luis', 'Marta', 'Jaime'].map((nombre, i) => ({ id: `p${i}`, nombre, invitado: false, consumo: 0 })) };
    const input = { datos, miParte: 'p0', pagador: '$yo', solicitudId: `trial_${randomUUID()}` };
    const imports = await Promise.all(Array.from({ length: 4 }, () => call('/grupos/desde-reparto', owner, 'POST', input, 201)));
    assert.equal(new Set(imports.map((g) => g.grupoId)).size, 1, 'concurrent retries create exactly one group');
    let group = await call(`/grupos/${imports[0].grupoId}`, owner);
    assert.equal(group.miembros.length, 5); assert.equal(group.resumen.totalGastado, 50000); assert.equal(group.balanceUsuario.teDeben, 40000);
    assert.ok(group.miembros.filter((m) => m.usuarioId !== owner.id).every((m) => m.usuario.sinCuenta));
    await call('/grupos/desde-reparto', owner, 'POST', { ...input, pagador: 'p1' }, 409);
    const count = await db.grupo.count({ where: { creadoPor: owner.id } });
    await call('/grupos/desde-reparto', owner, 'POST', { ...input, solicitudId: `bad_${randomUUID()}`, miParte: 'missing' }, 400);
    await call('/grupos/desde-reparto', owner, 'POST', { ...input, solicitudId: `bad_${randomUUID()}`, datos: { ...datos, participantes: datos.participantes.map((p) => ({ ...p, nombre: 'Duplicado' })) } }, 400);
    assert.equal(await db.grupo.count({ where: { creadoPor: owner.id } }), count, 'failed imports leave no group, expense or users');
    const birth = await call('/grupos/desde-reparto', owner, 'POST', { ...input, solicitudId: `birth_${randomUUID()}`, datos: { ...datos, totalCuenta: 20000, participantes: datos.participantes.map((p) => ({ ...p, invitado: p.id === 'p4' })) } }, 201);
    group = await call(`/grupos/${birth.grupoId}`, owner);
    assert.equal(group.balanceUsuario.teDeben, 15000);
    assert.equal(group.resumen.cuentas.find((p) => p.nombre === 'Jaime').tuParte, 0);

    // Historical money is cumulative. The organizer's covered share is not a self-transfer.
    const previous = await db.cuentaRapida.create({ data: { creadoPor: owner.id, nombre: datos.nombre, datos, aportes: { p0: 10000, p1: 2000, p2: 10000 }, recibidos: ['p0', 'p2'], historial: [{ evento: 'creada', fecha: new Date().toISOString() }] } });
    const conversion = { miParte: 'p0', pagador: '$yo', version: 1 };
    await call(`/cuentas-rapidas/${previous.id}/pasar-a-grupo`, other, 'POST', conversion, 404);
    await call(`/cuentas-rapidas/${previous.id}/pasar-a-grupo`, owner, 'POST', { ...conversion, version: 2 }, 409);
    const conversions = await Promise.all([1, 2].map(() => call(`/cuentas-rapidas/${previous.id}/pasar-a-grupo`, owner, 'POST', conversion, 201)));
    assert.equal(conversions[0].grupoId, conversions[1].grupoId);
    const preserved = await db.cuentaRapida.findUniqueOrThrow({ where: { id: previous.id } });
    assert.deepEqual(preserved.datos, previous.datos); assert.deepEqual(preserved.aportes, previous.aportes); assert.deepEqual(preserved.recibidos, previous.recibidos);
    assert.deepEqual(preserved.historial.slice(0, -1), previous.historial); assert.equal(preserved.grupoId, conversions[0].grupoId);
    group = await call(`/grupos/${preserved.grupoId}`, owner);
    assert.equal(group.resumen.totalGastado, 50000); assert.equal(group.balanceUsuario.teDeben, 28000);
    const payments = await db.pago.findMany({ where: { grupoId: group.id } });
    assert.equal(payments.length, 2); assert.deepEqual(payments.map((p) => p.monto).sort((a, b) => a - b), [2000, 10000]);
    assert.ok(payments.every((p) => p.estado === 'exitoso' && p.pagadorId !== p.receptorId && p.resueltoPor === owner.id));
    await call(`/cuentas-rapidas/${previous.id}/aportes`, owner, 'POST', { participanteId: 'p1', monto: 5000, version: preserved.version }, 409);
    await call(`/cuentas-rapidas/${previous.id}`, owner, 'PUT', { ...datos, version: preserved.version }, 409);
    await call(`/cuentas-rapidas/${previous.id}/archivo`, owner, 'POST', { archivada: false, version: preserved.version }, 409);
    assert.equal((await call(`/cuentas-rapidas/${previous.id}`, owner)).grupoId, group.id, 'the old reference stays readable');

    // An administrator organizing for somebody else is not automatically a participant/payer.
    const separate = await call('/grupos/desde-reparto', owner, 'POST', { ...input, miParte: null, pagador: 'p1', solicitudId: `separate_${randomUUID()}` }, 201);
    group = await call(`/grupos/${separate.grupoId}`, owner);
    assert.equal(group.miembros.length, 6); assert.equal(group.balanceUsuario.teDeben, 0); assert.equal(group.balanceUsuario.debes, 0);
    assert.equal(group.resumen.cuentas.find((p) => p.nombre === 'Ana').neto, 40000);
    console.log('PASS: trial import, exact shares/exclusions, explicit payer/identity, concurrent idempotency, historical partial/full payments preserved, no self-payments, immutable reference, ownership and rollback. No external sends.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
