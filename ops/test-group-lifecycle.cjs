// Local integration: closing, settlement, correction, archive, invitations and complete history.
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials.js');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const tag = Date.now();
async function run() {
  const server = startApi(3046, {});
  const cases = [];
  try {
    await server.ready;
    const users = [];
    for (const nombre of ['Sofía', 'Ana', 'Luis', 'Fuera']) {
      const u = await db.usuario.create({ data: { nombre: `${nombre} Cierre QA`, email: `qa-close-${tag}-${users.length}@example.invalid`, passwordHash: 'fictional-only', emailVerificado: true } });
      users.push({ ...u, token: jwt.sign({ userId: u.id, email: u.email, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '20m' }) });
    }
    const [sofia, ana, luis, outsider] = users;
    async function raw(path, user = sofia, method = 'GET', body) {
      return fetch(`http://127.0.0.1:3046/api${path}`, { method, headers: { 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1', ...(user ? { Authorization: `Bearer ${user.token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    }
    async function call(path, user = sofia, method = 'GET', body, status = 200) {
      const r = await raw(path, user, method, body);
      const data = r.status === 204 ? null : await r.json();
      assert.equal(r.status, status, `${method} ${path}: ${JSON.stringify(data)}`);
      return data;
    }
    const group = await call('/grupos', sofia, 'POST', { nombre: `Cierre QA ${tag}`, tipo: 'viaje', aprobacionPagos: 'administrador', integrantes: ['Marta sin app'] }, 201);
    const path = `/grupos/${group.id}`;
    const oldLink = group.linkInvitacion;
    const placeholder = await db.grupoMiembro.findFirstOrThrow({ where: { grupoId: group.id, usuario: { sinCuenta: true } } });
    await call('/grupos/unirse', ana, 'POST', { link: oldLink });
    await call('/grupos/unirse', luis, 'POST', { link: oldLink });
    await db.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: group.id, usuarioId: luis.id } }, data: { rol: 'admin' } });
    await call(`${path}/ciclo`, null, 'POST', { accion: 'cerrar' }, 401);
    await call(`${path}/ciclo`, outsider, 'POST', { accion: 'cerrar' }, 403);
    await call(`${path}/ciclo`, ana, 'POST', { accion: 'cerrar' }, 403);
    cases.push('only active administrators can close/reopen/delete; authenticated member reads');
    const expenseInput = { descripcion: 'Cena original', montoTotal: 10000, pagadoPor: sofia.id, tipoDivision: 'igual', participantes: [{ usuarioId: sofia.id }, { usuarioId: ana.id }] };
    const expense = await call(`${path}/gastos`, sofia, 'POST', expenseInput, 201);
    await call(`/gastos/${expense.id}`, sofia, 'PUT', { ...expenseInput, descripcion: 'Cena corregida', montoTotal: 12000 });
    let history = await call(`${path}/movimientos?tipo=cambios`);
    const correction = history.movimientos.find(e => e.estado === 'gasto_editado');
    assert.equal(correction.detalle.antes.montoTotal, 10000);
    assert.equal(correction.detalle.despues.montoTotal, 12000);
    assert.equal(correction.detalle.despues.participantes.find(p => p.usuarioId === ana.id).montoAsignado, 6000);
    assert.ok((await call(`${path}/chat`)).some(e => e.tipo === 'cambio' && /corregida/.test(e.texto)));
    assert.ok((await call('/actividad')).some(e => e.tipo === 'cambio' && e.grupoId === group.id));
    await call(`${path}/movimientos`, outsider, 'GET', undefined, 403);
    await call(`${path}/movimientos?desde=2026-02-30`, sofia, 'GET', undefined, 400);
    await call(`${path}/movimientos?desde=2026-10-15&hasta=2026-10-14`, sofia, 'GET', undefined, 400);
    await call(`${path}/movimientos?cursor=bad`, sofia, 'GET', undefined, 400);
    await call(`${path}/movimientos?zona=bad`, sofia, 'GET', undefined, 400);
    cases.push('corrections preserve before/after allocations and appear in chat, activity and search');
    const statementBefore = await call(`${path}/estado-cuenta`);
    const waiting = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: sofia.id, monto: 6000, metodo: 'yape', fechaEfectiva: '2026-10-14' }, 201);
    await db.invitacion.create({ data: { grupoId: group.id, invitadoId: outsider.id, invitadoPor: sofia.id } });
    assert.equal((await call(`${path}/ciclo`, sofia, 'POST', { accion: 'cerrar' })).estado, 'por_liquidar');
    await call(`${path}/ciclo`, sofia, 'POST', { accion: 'cerrar' });
    assert.equal(await db.eventoGrupo.count({ where: { grupoId: group.id, tipo: 'cierre_solicitado' } }), 1, 'repeat tap is idempotent');
    let detail = await call(path);
    assert.equal(detail.estado, 'por_liquidar'); assert.equal(detail.balanceUsuario.teDeben, 6000);
    assert.equal((await call(`${path}/estado-cuenta`)).grupo.estado, 'por_liquidar');
    assert.notEqual(statementBefore.version, (await call(`${path}/estado-cuenta`)).version);
    await call(`${path}/gastos`, sofia, 'POST', expenseInput, 409);
    await call(`/gastos/${expense.id}`, sofia, 'PUT', { descripcion: 'No se permite' }, 409);
    await call(`/gastos/${expense.id}`, sofia, 'DELETE', undefined, 409);
    await call(path, sofia, 'PUT', { nombre: 'No se permite' }, 409);
    await call(`${path}/integrantes`, sofia, 'POST', { nombres: ['Nuevo'] }, 409);
    await call(`${path}/invitar`, sofia, 'POST', {}, 409);
    await call(`/grupos/invitacion/${oldLink}`, outsider, 'GET', undefined, 404);
    await call(`/grupos/invitacion/${placeholder.codigoPersonal}`, outsider, 'GET', undefined, 404);
    assert.equal((await db.invitacion.findFirst({ where: { grupoId: group.id, invitadoId: outsider.id } })).estado, 'cancelada');
    cases.push('closing freezes expenses/settings/members and revokes pending and personal invitations');
    await call(`${path}/archivo`, ana, 'PUT', { archivar: true });
    assert.equal((await call('/grupos', ana)).find(g => g.id === group.id).archivado, true);
    assert.equal((await call('/grupos', sofia)).find(g => g.id === group.id).archivado, false);
    assert.ok((await call(path, sofia)).miembros.every(m => !Object.hasOwn(m, 'archivadoEn')), 'personal archive timestamps never leak to other members');
    assert.equal((await call('/grupos', ana)).find(g => g.id === group.id).balanceUsuario.debes, 6000);
    assert.equal((await call(path, ana)).archivado, true);
    await call(`${path}/archivo`, outsider, 'PUT', { archivar: true }, 403);
    await call(`/pagos/${waiting.id}/confirmar`, luis, 'POST', {});
    detail = await call(path);
    assert.equal(detail.estado, 'cerrado'); assert.ok(detail.cerradoEn); assert.equal(detail.resumen.saldos.length, 0);
    let closedStatement = await call(`${path}/estado-cuenta`);
    assert.equal(closedStatement.grupo.estado, 'cerrado'); assert.equal(closedStatement.totales.saldo, 0);
    for (const formato of ['pdf', 'xlsx']) {
      const r = await raw(`${path}/estado-cuenta/archivo?formato=${formato}&version=${closedStatement.version}`);
      assert.equal(r.status, 200); assert.ok((await r.arrayBuffer()).byteLength > 1000);
    }
    await call(`/pagos/${waiting.id}/rechazar`, sofia, 'POST', {});
    assert.equal((await call(path)).estado, 'por_liquidar');
    const direct = await call('/pagos/recibido', sofia, 'POST', { grupoId: group.id, pagadorId: ana.id, monto: 6000, metodo: 'efectivo', fechaEfectiva: '2026-10-14' }, 201);
    assert.equal((await call(path)).estado, 'cerrado');
    assert.equal((await call(`/pagos/${direct.id}`, ana)).estado, 'exitoso');
    cases.push('archiving is personal and preserves debt; confirmed final payment closes automatically; dispute reopens settlement');
    await call(`${path}/ciclo`, sofia, 'POST', { accion: 'eliminar-vacio' }, 409);
    await call(`${path}/ciclo`, sofia, 'POST', { accion: 'reabrir' });
    const reopened = await call(path);
    assert.equal(reopened.estado, 'abierto'); assert.equal(reopened.cerradoEn, null); assert.notEqual(reopened.linkInvitacion, oldLink);
    assert.notEqual(reopened.miembros.find(m => m.usuarioId === placeholder.usuarioId).codigoPersonal, placeholder.codigoPersonal);
    await call('/grupos/unirse', outsider, 'POST', { link: oldLink }, 400);
    await call(`${path}/archivo`, ana, 'PUT', { archivar: false });
    assert.equal((await call(path, ana)).archivado, false);
    const removed = await call(`${path}/gastos`, sofia, 'POST', { ...expenseInput, descripcion: 'Gasto a retirar', montoTotal: 100 }, 201);
    await call(`/gastos/${removed.id}`, sofia, 'DELETE');
    assert.ok((await call(`${path}/movimientos?tipo=cambios`)).movimientos.some(e => e.estado === 'gasto_eliminado' && e.detalle.antes.montoTotal === 100));
    cases.push('reopening preserves history, rotates invitations and permits new expenses; deletion leaves an audit event');
    // More than the chat's 150 expenses, with identical timestamps across all three sources.
    const stamp = new Date('2026-10-14T21:00:00Z');
    const seededExpenses = [];
    for (let i = 0; i < 165; i++) seededExpenses.push(await db.gasto.create({ data: { grupoId: group.id, creadoPor: sofia.id, pagadoPor: sofia.id, descripcion: `Historial completo ${i}`, montoTotal: 100, fecha: stamp, fechaRegistro: stamp, participantes: { create: { usuarioId: sofia.id, montoAsignado: 100 } } } }));
    await db.pago.create({ data: { grupoId: group.id, pagadorId: ana.id, receptorId: sofia.id, monto: 1, estado: 'rechazado', fechaPago: stamp, fechaEfectiva: new Date('2026-10-14T00:00:00Z') } });
    await db.eventoGrupo.create({ data: { grupoId: group.id, autorId: sofia.id, tipo: 'prueba', texto: 'Historial completo prueba', fecha: stamp } });
    const seen = new Set(); let cursor = null; let pages = 0;
    do {
      const page = await call(`${path}/movimientos?desde=2026-10-14&hasta=2026-10-14${cursor ? `&cursor=${cursor}` : ''}`);
      for (const row of page.movimientos) { assert.ok(!seen.has(row.clave), 'no duplicate pagination ties'); seen.add(row.clave); }
      cursor = page.siguiente; pages++;
      assert.ok(pages < 15);
    } while (cursor);
    for (const e of seededExpenses) assert.ok(seen.has(`gasto-${e.id}`), 'all historical expenses found');
    assert.ok(pages >= 6);
    assert.ok((await call(`${path}/movimientos?buscar=Ana&tipo=gastos`)).movimientos.some(e => e.id === expense.id), 'search participants, not only payer');
    // A Lima late-night expense belongs to the previous local day, unlike a payment calendar date.
    const late = await db.gasto.create({ data: { grupoId: group.id, creadoPor: sofia.id, pagadoPor: sofia.id, descripcion: 'Trasnoche', montoTotal: 100, fecha: new Date('2026-10-15T02:00:00Z'), participantes: { create: { usuarioId: sofia.id, montoAsignado: 100 } } } });
    assert.ok((await call(`${path}/movimientos?buscar=Trasnoche&desde=2026-10-14&hasta=2026-10-14&zona=America/Lima`)).movimientos.some(e => e.id === late.id));
    assert.equal((await call(`${path}/movimientos?buscar=Trasnoche&desde=2026-10-14&hasta=2026-10-14&zona=UTC`)).movimientos.length, 0);
    cases.push('complete paginated history exceeds chat limits; stable ties across sources; dates match device zone');
    // Last real member cannot strand debts between people who do not have the app.
    const namedGroup = await call('/grupos', sofia, 'POST', { nombre: `Solo nombres ${tag}`, integrantes: ['Uno', 'Dos'] }, 201);
    const named = await call(`/grupos/${namedGroup.id}`);
    const names = named.miembros.filter(m => m.usuario.sinCuenta);
    await call(`/grupos/${namedGroup.id}/gastos`, sofia, 'POST', { ...expenseInput, pagadoPor: names[0].usuarioId, participantes: names.map(m => ({ usuarioId: m.usuarioId })) }, 201);
    await call(`/grupos/${namedGroup.id}/salir`, sofia, 'DELETE', undefined, 409);
    const empty = await call('/grupos', sofia, 'POST', { nombre: `Vacío ${tag}` }, 201);
    assert.equal((await call(`/grupos/${empty.id}/ciclo`, sofia, 'POST', { accion: 'cerrar' })).estado, 'cerrado');
    await call(`/grupos/${empty.id}/ciclo`, sofia, 'POST', { accion: 'eliminar-vacio' });
    await call(`/grupos/${empty.id}/movimientos`, sofia, 'GET', undefined, 403);
    assert.ok(!(await call('/grupos')).some(g => g.id === empty.id));
    cases.push('empty groups can close/delete; last account cannot strand name-only debts');
    // Everyone's net may be zero while direct debts still form a cycle.
    const cycle = await call('/grupos', sofia, 'POST', { nombre: `Ciclo ${tag}` }, 201);
    await call('/grupos/unirse', ana, 'POST', { link: cycle.linkInvitacion });
    await call('/grupos/unirse', luis, 'POST', { link: cycle.linkInvitacion });
    const cycleUsers = [sofia, ana, luis];
    for (let i = 0; i < 3; i++) await call(`/grupos/${cycle.id}/gastos`, sofia, 'POST', { ...expenseInput, montoTotal: 100, pagadoPor: cycleUsers[i].id, participantes: [{ usuarioId: cycleUsers[(i + 1) % 3].id }] }, 201);
    const cycling = await call(`/grupos/${cycle.id}`);
    assert.ok(cycling.resumen.cuentas.every(c => c.neto === 0)); assert.equal(cycling.resumen.saldos.length, 3);
    assert.equal((await call(`/grupos/${cycle.id}/ciclo`, sofia, 'POST', { accion: 'cerrar' })).estado, 'por_liquidar');
    cases.push('zero net per person never hides unsettled person-to-person debt cycles');
    // The same row lock serializes close against expense creation.
    const race = await call('/grupos', sofia, 'POST', { nombre: `Carrera ${tag}` }, 201);
    const raceExpense = { ...expenseInput, solicitudId: require('node:crypto').randomUUID(), participantes: [{ usuarioId: sofia.id }] };
    const [closed, created] = await Promise.all([
      raw(`/grupos/${race.id}/ciclo`, sofia, 'POST', { accion: 'cerrar' }),
      raw(`/grupos/${race.id}/gastos`, sofia, 'POST', raceExpense),
    ]);
    assert.equal(closed.status, 200); assert.ok([201, 409].includes(created.status));
    assert.equal((await call(`/grupos/${race.id}`)).estado, 'cerrado');
    assert.equal(await db.gasto.count({ where: { grupoId: race.id } }), created.status === 201 ? 1 : 0);
    if (created.status === 201) await call(`/grupos/${race.id}/gastos`, sofia, 'POST', raceExpense, 200);
    cases.push('concurrent close/expense produces a consistent final ledger');
    console.log(`PASS: ${cases.length} integration scenarios\n- ${cases.join('\n- ')}`);
  } catch (error) { console.error(server.log()); throw error; }
  finally { server.child.kill(); await db.$disconnect(); }
}
run().catch(e => { console.error(e); process.exitCode = 1; });
