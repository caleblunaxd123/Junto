// Local fictional users, no push tokens, no SMTP and no external provider requests.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3040, {});
  try {
    await server.ready;
    async function user(nombre) {
      const u = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: u.id, token: jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const owner = await user('Davetsy QA'), ana = await user('Ana QA'), beto = await user('Beto QA');
    async function call(path, who, method = 'GET', body, status = 200) {
      const r = await fetch('http://127.0.0.1:3040/api' + path, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: body ? JSON.stringify(body) : undefined });
      const data = r.status === 204 ? null : await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data;
    }
    const group = await call('/grupos', owner, 'POST', { nombre: 'Cumpleaños QA', integrantes: ['Ana', 'Gerson', 'Caleb', 'Sandra', 'Jaime'] }, 201);
    let g = await call(`/grupos/${group.id}`, owner);
    const name = (value) => g.miembros.find((m) => m.usuario.nombre === value);
    await call('/grupos/unirse', ana, 'POST', { link: name('Ana').codigoPersonal });
    g = await call(`/grupos/${group.id}`, owner);
    const birthday = name('Jaime').usuarioId;
    await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Almuerzo con invitado', montoTotal: 18000, pagadoPor: owner.id, participantes: g.miembros.filter((m) => m.usuarioId !== birthday).map((m) => ({ usuarioId: m.usuarioId })) }, 201);
    g = await call(`/grupos/${group.id}`, owner);
    assert.equal(g.resumen.cuentas.find((a) => a.usuarioId === birthday).tuParte, 0);
    assert.equal(g.resumen.cuentas.find((a) => a.usuarioId === ana.id).neto, -3600);
    const paid = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: owner.id, monto: 1000, metodo: 'yape', fechaEfectiva: '2026-10-09' }, 201);
    assert.equal(paid.fechaEfectiva.slice(0, 10), '2026-10-09');
    g = await call(`/grupos/${group.id}`, owner);
    assert.equal(g.resumen.cuentas.find((a) => a.usuarioId === ana.id).neto, -3600);
    const notice = (await call('/notificaciones', owner)).find((n) => n.pagoId === paid.id);
    assert.equal(notice.tipo, 'pago_reportado'); assert.equal(notice.leido, false);
    await call(`/notificaciones/${notice.id}/leida`, beto, 'POST', {}, 404);
    await call(`/pagos/${paid.id}/confirmar`, ana, 'POST', {}, 400);
    await call(`/pagos/${paid.id}/confirmar`, owner, 'POST', {});
    await call(`/pagos/${paid.id}/confirmar`, owner, 'POST', {}, 400);
    assert.equal((await call('/notificaciones', ana)).filter((n) => n.pagoId === paid.id && n.tipo === 'pago_confirmado').length, 1);
    assert.equal((await call(`/grupos/${group.id}`, owner)).resumen.cuentas.find((a) => a.usuarioId === ana.id).neto, -2600);

    // Creating the group is not authority to approve a payment received by someone else.
    const other = await call('/grupos', owner, 'POST', { nombre: 'Otro receptor QA', integrantes: ['Sin cuenta QA'] }, 201);
    await call('/grupos/unirse', ana, 'POST', { link: other.linkInvitacion });
    await call('/grupos/unirse', beto, 'POST', { link: other.linkInvitacion });
    await call(`/grupos/${other.id}/gastos`, owner, 'POST', { descripcion: 'Ana adelantó', montoTotal: 9000, pagadoPor: ana.id, participantes: [owner.id, ana.id, beto.id].map((usuarioId) => ({ usuarioId })) }, 201);
    const second = await call('/pagos/reportar', beto, 'POST', { grupoId: other.id, receptorId: ana.id, monto: 1000, metodo: 'transferencia' }, 201);
    assert.equal((await call('/notificaciones', owner)).filter((n) => n.pagoId === second.id).length, 0);
    await call(`/pagos/${second.id}/confirmar`, owner, 'POST', {}, 400);
    await call(`/pagos/${second.id}/rechazar`, ana, 'POST', {});
    assert.equal((await call('/notificaciones', beto)).find((n) => n.pagoId === second.id).tipo, 'pago_rechazado');
    await call(`/grupos/${other.id}`, owner, 'PUT', { aprobacionPagos: 'administrador' });
    const reversed = await call('/pagos/reportar', beto, 'POST', { grupoId: other.id, receptorId: ana.id, monto: 1000, metodo: 'transferencia' }, 201);
    await call(`/pagos/${reversed.id}/confirmar`, owner, 'POST', {});
    await call(`/pagos/${reversed.id}/rechazar`, ana, 'POST', {});
    assert.ok((await call('/notificaciones', owner)).find((n) => n.pagoId === reversed.id && n.tipo === 'pago_rechazado'), 'The previous approving admin also receives the durable reversal notice');
    await call(`/grupos/${other.id}`, owner, 'PUT', { aprobacionPagos: 'receptor' });
    const detail = await call(`/grupos/${other.id}`, owner);
    const placeholder = detail.miembros.find((m) => m.usuario.sinCuenta).usuarioId;
    await call(`/grupos/${other.id}/gastos`, owner, 'POST', { descripcion: 'Adelanto sin cuenta', montoTotal: 30000, pagadoPor: placeholder, participantes: [{ usuarioId: beto.id }] }, 201);
    const third = await call('/pagos/reportar', beto, 'POST', { grupoId: other.id, receptorId: placeholder, monto: 2000, metodo: 'efectivo' }, 201);
    assert.ok((await call('/pagos/historial', owner)).find((p) => p.id === third.id)?.permisos.aprobar);
    assert.ok((await call('/notificaciones', owner)).find((n) => n.pagoId === third.id));
    const approvers = (await call(`/pagos/${third.id}`, owner)).aprobadores;
    assert.ok(approvers.some((a) => a.id === owner.id));
    await call(`/pagos/${third.id}/confirmar`, owner, 'POST', {});

    // Immutable reference snapshot, original amount and applied rate are distinct facts.
    const cop = await call('/grupos', owner, 'POST', { nombre: 'COP referencia QA', moneda: 'COP' }, 201);
    await call('/grupos/unirse', ana, 'POST', { link: cop.linkInvitacion });
    await call(`/grupos/${cop.id}/gastos`, owner, 'POST', { descripcion: 'Cuenta COP', montoTotal: 1000000, pagadoPor: owner.id, participantes: [{ usuarioId: owner.id }, { usuarioId: ana.id }] }, 201);
    const ref = await db.cotizacionCambio.create({ data: { clave: randomUUID(), origen: 'USD', destino: 'COP', fecha: new Date('2026-10-09T00:00:00Z'), tasa: '3990', fuente: 'Referencia ficticia local QA' } });
    const input = { grupoId: cop.id, receptorId: owner.id, monto: 500000, metodo: 'transferencia', fechaEfectiva: '2026-10-10', conversion: { monedaOrigen: 'USD', montoOrigen: 125, tipoCambio: '4000', cotizacionId: ref.id } };
    await call('/pagos/reportar', ana, 'POST', { ...input, fechaEfectiva: '2026-10-01' }, 400);
    await call('/pagos/reportar', ana, 'POST', { ...input, fechaEfectiva: '2099-01-01' }, 400);
    await call('/pagos/reportar', ana, 'POST', { ...input, conversion: { ...input.conversion, monedaOrigen: 'EUR' } }, 400);
    const voucher = await db.comprobante.create({ data: { subidoPor: ana.id, grupoId: cop.id, hash: randomUUID().replace(/-/g, '').padEnd(64, '0'), monedaLeida: 'USD', montoLeido: 125, app: 'transferencia' } });
    await call('/pagos/reportar', ana, 'POST', { ...input, conversion: undefined, comprobanteId: voucher.id }, 400);
    const converted = await call('/pagos/reportar', ana, 'POST', { ...input, comprobanteId: voucher.id }, 201);
    assert.equal(converted.tipoCambio, '4000'); assert.equal(converted.referenciaCambio.tasa, '3990');
    await call(`/pagos/${converted.id}/confirmar`, owner, 'POST', {});
    assert.equal((await call(`/grupos/${cop.id}`, owner)).resumen.cuentas.find((a) => a.usuarioId === ana.id).neto, 0);
    await call(`/pagos/tipo-cambio?grupoId=${cop.id}&origen=USD&fecha=2026-99-99`, ana, 'GET', undefined, 400);
    await call(`/pagos/tipo-cambio?grupoId=${cop.id}&origen=USD&fecha=2026-10-09`, beto, 'GET', undefined, 403);
    console.log('PASS: birthday exclusion, partial payment, durable recipient notices without push, single confirmation, no creator bypass, name-only receiver approval, applied/reference rates and date validation.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack); process.exitCode = 1; });
