// LOCAL QA: recurring expenses (rent, internet). Fictional accounts, loopback API, local DB only.
// The job is exercised in-process with explicit "today" values, so no clock is changed.
// Usage: DATABASE_URL=<local QA db> JWT_SECRET=<fictional> node ops/test-recurring-expenses.cjs  (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const { runRule, generarRecurrentes } = require('../apps/api/dist/services/recurrentes.service');
const { calendarToday } = require('../apps/api/dist/domain/recurrence');
const db = new PrismaClient();
const suffix = Date.now();
const PORT = 3048;

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
      const email = `qa-rec-${slug}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre, email, password: `Recurring${suffix}!` });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return call('/auth/verify-email', null, 'POST', { email, otp: otpCode });
    }
    const caleb = await account('Caleb QA', 'caleb');
    const sofia = await account('Sofía QA', 'sofia');
    const outsider = await account('Fuera QA', 'fuera');
    const depa = await call('/grupos', caleb, 'POST', { nombre: `Depa ${suffix}`, tipo: 'roomies', integrantes: ['Diego'] });
    await call('/grupos/unirse', sofia, 'POST', { link: depa.linkInvitacion });
    const detail = await call(`/grupos/${depa.id}`, caleb);
    const diego = detail.miembros.find((m) => m.usuario.nombre === 'Diego').usuarioId;
    const everyone = detail.miembros.map((m) => ({ usuarioId: m.usuarioId }));
    const today = calendarToday();
    const base = { descripcion: 'Alquiler', categoria: 'alojamiento', montoTotal: 150001, pagadoPor: caleb.usuario.id, tipoDivision: 'igual', participantes: everyone, frecuencia: 'mensual' };

    // Invalid rules are refused up front: past first date, bad split, outsider.
    await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, primeraFecha: '2020-01-01' }, 400);
    await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, primeraFecha: today, tipoDivision: 'exacto', participantes: [{ usuarioId: caleb.usuario.id, monto: 1 }] }, 400);
    await call(`/grupos/${depa.id}/recurrentes`, outsider, 'POST', { ...base, primeraFecha: today }, 403);

    // Starting today: the first rent is added at once, split exactly (S/ 1,500.01 / 3).
    const rent = await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, primeraFecha: today, solicitudId: `rent-${suffix}` });
    assert.equal(rent.gastosCreados, 1);
    assert.equal(rent.activo, true);
    const first = await db.gasto.findFirstOrThrow({ where: { recurrenteId: rent.id }, include: { participantes: true } });
    assert.deepEqual(first.participantes.map((p) => p.montoAsignado).sort((a, b) => b - a), [50001, 50000, 50000]);
    assert.equal(first.fecha.toISOString().slice(0, 10), today, 'dated on its calendar day');
    // The same request again (double tap / retry) returns the same rule, no second rent.
    const again = await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, primeraFecha: today, solicitudId: `rent-${suffix}` });
    assert.equal(again.id, rent.id);
    assert.equal(await db.gasto.count({ where: { recurrenteId: rent.id } }), 1);
    // An idempotency key cannot return another group's private recurring template, or accept changed data.
    await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, montoTotal: 999, primeraFecha: today, solicitudId: `rent-${suffix}` }, 409);
    const other = await call('/grupos', caleb, 'POST', { nombre: `Otro ${suffix}`, tipo: 'roomies' });
    await call(`/grupos/${other.id}/recurrentes`, caleb, 'POST', { ...base, primeraFecha: today, solicitudId: `rent-${suffix}` }, 409);
    await call(`/grupos/${other.id}/recurrentes/${rent.id}`, caleb, 'PATCH', { activo: false }, 404);
    await call(`/grupos/${other.id}/recurrentes/${rent.id}`, caleb, 'DELETE', undefined, 404);

    // Simulate the server being off for three months: the job adds each missed month once,
    // and running it twice (or twice at the same time) never duplicates.
    await db.gastoRecurrente.update({ where: { id: rent.id }, data: { proximaFecha: new Date('2026-07-31T00:00:00Z'), diaMes: 31 } });
    const [a, b] = await Promise.all([runRule(rent.id, '2026-10-15'), runRule(rent.id, '2026-10-15')]);
    assert.equal(a + b, 3, 'July 31, August 31, September 30 — once each');
    assert.equal((await generarRecurrentes('2026-10-15')).creados, 0, 'a second run adds nothing');
    const rows = await db.gasto.findMany({ where: { recurrenteId: rent.id }, select: { fecha: true }, orderBy: { fecha: 'asc' } });
    assert.deepEqual(rows.map((r) => r.fecha.toISOString().slice(0, 10)).filter((d) => d < today), ['2026-07-31', '2026-08-31', '2026-09-30']);
    assert.equal((await db.gastoRecurrente.findUniqueOrThrow({ where: { id: rent.id } })).proximaFecha.toISOString().slice(0, 10), '2026-10-31');

    // A weekly one starting next week adds nothing yet.
    const week = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const groceries = await call(`/grupos/${depa.id}/recurrentes`, sofia, 'POST', { ...base, descripcion: 'Compras', categoria: 'compras', montoTotal: 9000, pagadoPor: sofia.usuario.id, frecuencia: 'semanal', primeraFecha: week });
    assert.equal(groceries.gastosCreados, 0);
    // Only who programmed it or an admin may pause it.
    await call(`/grupos/${depa.id}/recurrentes/${rent.id}`, sofia, 'PATCH', { activo: false }, 403);
    // Pause, then resume: no back-fill of the paused period.
    await call(`/grupos/${depa.id}/recurrentes/${rent.id}`, caleb, 'PATCH', { activo: false });
    await db.gastoRecurrente.update({ where: { id: rent.id }, data: { proximaFecha: new Date('2026-01-31T00:00:00Z') } });
    const before = await db.gasto.count({ where: { recurrenteId: rent.id } });
    const resumed = await call(`/grupos/${depa.id}/recurrentes/${rent.id}`, caleb, 'PATCH', { activo: true });
    assert.equal(await db.gasto.count({ where: { recurrenteId: rent.id } }), before, 'resuming never adds months that were paused');
    assert.ok(resumed.proximaFecha >= today);

    // A worker that read the template before a pause must re-check it under the group lock.
    const { crearGasto } = require('../apps/api/dist/services/gastos.service');
    await call(`/grupos/${depa.id}/recurrentes/${rent.id}`, caleb, 'PATCH', { activo: false });
    await assert.rejects(crearGasto(depa.id, { ...base, fecha: `${today}T17:00:00Z`, solicitudId: `stale-${suffix}` }, caleb.usuario.id, { recurrenteId: rent.id, occurrence: today, next: week }), e => e.code === 'RECURRENCE_CHANGED');
    assert.equal(await db.gasto.count({ where: { recurrenteId: rent.id } }), before, 'paused rule cannot create a stale occurrence');

    // Someone in the split leaves the group: the rule pauses itself and says why, nothing half-created.
    await db.gastoRecurrente.update({ where: { id: groceries.id }, data: { proximaFecha: new Date(`${today}T00:00:00Z`) } });
    await db.grupoMiembro.updateMany({ where: { grupoId: depa.id, usuarioId: diego }, data: { activo: false } });
    assert.equal(await runRule(groceries.id, today), 0);
    const paused = (await call(`/grupos/${depa.id}/recurrentes`, caleb)).find((r) => r.id === groceries.id);
    assert.equal(paused.activo, false);
    assert.ok(paused.pausaMotivo, 'it explains why it stopped');
    await db.grupoMiembro.updateMany({ where: { grupoId: depa.id, usuarioId: diego }, data: { activo: true } });

    // A process error halfway through catch-up cannot leave an already-created occurrence pending.
    const interrupted = await call(`/grupos/${depa.id}/recurrentes`, caleb, 'POST', { ...base, descripcion: 'Internet recuperado', frecuencia: 'semanal', primeraFecha: week });
    const missed = new Date(`${today}T00:00:00Z`); missed.setUTCDate(missed.getUTCDate() - 14);
    const firstDay = missed.toISOString().slice(0, 10);
    await db.gastoRecurrente.update({ where: { id: interrupted.id }, data: { proximaFecha: missed } });
    const expenseService = require('../apps/api/dist/services/gastos.service');
    const originalCreate = expenseService.crearGasto;
    let calls = 0;
    expenseService.crearGasto = (...args) => { if (++calls === 2) throw new Error('simulated process interruption'); return originalCreate(...args); };
    try { await assert.rejects(runRule(interrupted.id, today), /simulated process interruption/); }
    finally { expenseService.crearGasto = originalCreate; }
    const interruptedRule = await db.gastoRecurrente.findUniqueOrThrow({ where: { id: interrupted.id } });
    assert.ok(interruptedRule.proximaFecha.toISOString().slice(0, 10) > firstDay, 'the first expense and next date committed together');
    assert.equal(await runRule(interrupted.id, today), 2, 'retry adds only the two remaining weeks');
    assert.equal(await db.gasto.count({ where: { recurrenteId: interrupted.id } }), 3);

    // Stopping it keeps every rent already added; the group history records each change.
    const added = await db.gasto.count({ where: { recurrenteId: rent.id } });
    await call(`/grupos/${depa.id}/recurrentes/${rent.id}`, caleb, 'DELETE', undefined, 204);
    assert.equal(await db.gasto.count({ where: { grupoId: depa.id, descripcion: 'Alquiler', activo: true } }), added);
    const events = await db.eventoGrupo.findMany({ where: { grupoId: depa.id, tipo: { startsWith: 'recurrente_' } }, select: { tipo: true } });
    assert.deepEqual([...new Set(events.map((e) => e.tipo))].sort(), ['recurrente_creado', 'recurrente_eliminado', 'recurrente_pausado', 'recurrente_reanudado']);
    // Balances stay exact: money is neither created nor lost.
    const final = await call(`/grupos/${depa.id}`, caleb);
    assert.equal(final.resumen.cuentas.reduce((t, x) => t + x.neto, 0), 0);
    // Closing freezes future spending immediately, including budget edits and automatic rules.
    await call(`/grupos/${depa.id}/recurrentes/${groceries.id}`, sofia, 'PATCH', { activo: true });
    await call(`/grupos/${depa.id}/ciclo`, caleb, 'POST', { accion: 'cerrar' });
    assert.equal((await db.gastoRecurrente.findUniqueOrThrow({ where: { id: groceries.id } })).activo, false);
    await call(`/grupos/${depa.id}/recurrentes/${groceries.id}`, sofia, 'PATCH', { activo: true }, 409);
    await call(`/grupos/${depa.id}/presupuesto`, caleb, 'PUT', { categoria: 'total', montoMensual: 100000 }, 409);
    assert.equal((await call(`/grupos/${depa.id}/presupuesto`, caleb)).total.porVenir, 0);
    await call(`/grupos/${depa.id}/ciclo`, caleb, 'POST', { accion: 'reabrir' });
    assert.equal((await db.gastoRecurrente.findUniqueOrThrow({ where: { id: groceries.id } })).activo, false, 'reopening never silently restarts automatic spending');
    console.log('PASS: recurring expenses — invalid rules refused, first one added at once with an exact split, idempotent request, missed months added once even with two concurrent runs, short months, permissions, pause/resume without back-fill, self-pause with a reason when someone left, stop keeps past expenses, history events, balances exact. Local data only.');
  } catch (error) {
    console.error(server.log().split(String.fromCharCode(10)).filter((line) => /error/i.test(line)).slice(-8).join(String.fromCharCode(10)));
    throw error;
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
