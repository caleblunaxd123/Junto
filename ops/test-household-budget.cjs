// LOCAL QA: household budget per month. Fictional accounts, loopback API, local DB only.
// Usage: DATABASE_URL=<local QA db> JWT_SECRET=<fictional> node ops/test-household-budget.cjs  (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const { calendarToday } = require('../apps/api/dist/domain/recurrence');
const db = new PrismaClient();
const suffix = Date.now();
const PORT = 3049;

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
      const email = `qa-bud-${slug}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre, email, password: `Budget${suffix}!` });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return call('/auth/verify-email', null, 'POST', { email, otp: otpCode });
    }
    const ana = await account('Ana QA', 'ana');
    const luis = await account('Luis QA', 'luis');
    const outsider = await account('Fuera QA', 'fuera');
    const group = await call('/grupos', ana, 'POST', { nombre: `Depa ${suffix}`, tipo: 'roomies' });
    await call('/grupos/unirse', luis, 'POST', { link: group.linkInvitacion });
    const both = [{ usuarioId: ana.usuario.id }, { usuarioId: luis.usuario.id }];
    const today = calendarToday();
    const month = today.slice(0, 7);

    // Empty month: nothing spent, no budget.
    let s = await call(`/grupos/${group.id}/presupuesto`, ana);
    assert.equal(s.mes, month);
    assert.deepEqual([s.total.gastado, s.total.presupuesto, s.total.estado], [0, null, 'sin_presupuesto']);

    // Budget lines; invalid amounts and outsiders refused.
    await call(`/grupos/${group.id}/presupuesto`, ana, 'PUT', { categoria: 'total', montoMensual: 200000 });
    await call(`/grupos/${group.id}/presupuesto`, luis, 'PUT', { categoria: 'comida', montoMensual: 40000 });
    await call(`/grupos/${group.id}/presupuesto`, ana, 'PUT', { categoria: 'comida', montoMensual: 0 }, 400);
    await call(`/grupos/${group.id}/presupuesto`, ana, 'PUT', { categoria: 'mascotas', montoMensual: 1000 }, 400);
    await call(`/grupos/${group.id}/presupuesto`, outsider, 'PUT', { categoria: 'total', montoMensual: 1 }, 403);
    await call(`/grupos/${group.id}/presupuesto`, outsider, 'GET', undefined, 403);

    // Spending this month (food 380 with 400 budget → cerca), rent programmed monthly from today, a payment
    // between people (not spending) and an expense dated last month (not counted).
    await call(`/grupos/${group.id}/gastos`, ana, 'POST', { descripcion: 'Mercado', montoTotal: 38000, pagadoPor: ana.usuario.id, tipoDivision: 'igual', categoria: 'comida', participantes: both });
    const lastMonth = new Date(`${month}-01T12:00:00Z`); lastMonth.setUTCDate(0);
    await call(`/grupos/${group.id}/gastos`, ana, 'POST', { descripcion: 'Viejo', montoTotal: 99900, pagadoPor: ana.usuario.id, tipoDivision: 'igual', categoria: 'comida', participantes: both, fecha: lastMonth.toISOString() });
    await call(`/grupos/${group.id}/recurrentes`, ana, 'POST', { descripcion: 'Alquiler', categoria: 'alojamiento', montoTotal: 120000, pagadoPor: ana.usuario.id, tipoDivision: 'igual', participantes: both, frecuencia: 'semanal', primeraFecha: today });
    await call('/pagos/reportar', luis, 'POST', { grupoId: group.id, receptorId: ana.usuario.id, monto: 10000, metodo: 'yape' });

    s = await call(`/grupos/${group.id}/presupuesto`, luis);
    const comida = s.categorias.find((c) => c.categoria === 'comida');
    assert.deepEqual([comida.gastado, comida.presupuesto, comida.estado, comida.disponible], [38000, 40000, 'cerca', 2000]);
    const vivienda = s.categorias.find((c) => c.categoria === 'alojamiento');
    assert.equal(vivienda.gastado, 120000, 'the first rent was added today');
    assert.equal(vivienda.porVenir, s.proximos.filter((p) => p.categoria === 'alojamiento').reduce((t, p) => t + p.monto, 0), 'what still comes is the weekly rent left this month');
    assert.ok(s.proximos.every((p) => p.dia > today && p.dia.startsWith(month)), 'upcoming = after today, within the month');
    assert.equal(s.total.gastado, 158000, 'payments between people are not spending; last month is not counted');
    assert.equal(s.total.proyectado, s.total.gastado + s.total.porVenir);

    // Last month shows the old expense and nothing to come; removing a line works; history records it.
    const prev = await call(`/grupos/${group.id}/presupuesto?mes=${lastMonth.toISOString().slice(0, 7)}`, ana);
    assert.equal(prev.total.gastado, 99900);
    assert.equal(prev.total.porVenir, 0);
    await call(`/grupos/${group.id}/presupuesto?mes=2026-13`, ana, 'GET', undefined, 400);
    s = await call(`/grupos/${group.id}/presupuesto`, ana, 'PUT', { categoria: 'comida', montoMensual: null });
    assert.equal(s.categorias.find((c) => c.categoria === 'comida').presupuesto, null);
    const events = await db.eventoGrupo.findMany({ where: { grupoId: group.id, tipo: { startsWith: 'presupuesto_' } }, select: { tipo: true } });
    assert.deepEqual(events.map((e) => e.tipo).sort(), ['presupuesto_fijado', 'presupuesto_fijado', 'presupuesto_quitado']);
    console.log('PASS: household budget — per-category and total limits, invalid input and outsiders refused, spending dated in the month only, payments are not spending, recurring expenses still to come, cerca/pasado states, previous month, removal, history. Local data only.');
  } catch (error) {
    console.error(server.log().split(String.fromCharCode(10)).filter((line) => /error/i.test(line)).slice(-8).join(String.fromCharCode(10)));
    throw error;
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
