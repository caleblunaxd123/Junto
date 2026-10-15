// LOCAL QA: "Por participaciones", JUNTO Simplifica (direct vs simplified debts), spending by category,
// a name replaced by who joined as them, and a payment confirmed twice. Fictional data, loopback only.
// Usage: DATABASE_URL=<local QA db> JWT_SECRET=<fictional> node ops/test-shares-simplify.cjs  (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
const PORT = 3041;

async function run() {
  const server = helpers.startApi(PORT, {});
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body, status) {
      const response = await fetch(`http://127.0.0.1:${PORT}/api${route}`, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json();
      if (status) assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      else assert.ok(response.ok, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function account(nombre, slug) {
      const email = `qa-shares-${slug}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre, email, password: `Shares${suffix}!` });
      const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
      return call('/auth/verify-email', null, 'POST', { email, otp: otpCode });
    }
    const caleb = await account('Caleb QA', 'caleb');
    const andrea = await account('Andrea QA', 'andrea');
    const group = await call('/grupos', caleb, 'POST', { nombre: `Participaciones ${suffix}`, tipo: 'viaje', integrantes: ['Andrea', 'Marco'] });
    let detail = await call(`/grupos/${group.id}`, caleb);
    const memberId = (name) => detail.miembros.find((m) => m.usuario.nombre.startsWith(name)).usuarioId;
    // Andrea joins as the "Andrea" added by name: that placeholder must leave the accounts.
    await call('/grupos/unirse', andrea, 'POST', { link: group.linkInvitacion, como: memberId('Andrea') });
    detail = await call(`/grupos/${group.id}`, caleb);
    const ana = andrea.usuario.id; const me = caleb.usuario.id; const marco = memberId('Marco');
    assert.equal(detail.resumen.cuentas.length, 3, 'three people in the accounts, no leftover "Andrea" with S/ 0.00');

    // 1. Shares 2-1-1 of S/ 100.01: exact to the cent, largest remainder, zero allowed.
    const base = { descripcion: 'Cena', montoTotal: 10001, pagadoPor: me, categoria: 'comida', tipoDivision: 'participaciones' };
    const created = await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { ...base, solicitudId: `shares-${suffix}`, participantes: [{ usuarioId: marco, participaciones: 2 }, { usuarioId: ana, participaciones: 1 }, { usuarioId: me, participaciones: 1 }] });
    const parts = Object.fromEntries((await db.gastoParticipante.findMany({ where: { gastoId: created.id } })).map((p) => [p.usuarioId, p.montoAsignado]));
    assert.deepEqual([parts[marco], parts[ana], parts[me]], [5001, 2500, 2500]);
    // Invalid shares never save: all zero, decimals, missing value, mixing with "partes".
    for (const participantes of [
      [{ usuarioId: marco, participaciones: 0 }, { usuarioId: ana, participaciones: 0 }],
      [{ usuarioId: marco, participaciones: 1.5 }],
      [{ usuarioId: marco, participaciones: 1 }, { usuarioId: ana }],
      [{ usuarioId: marco, participaciones: 1001 }],
    ]) await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { ...base, participantes }, 400);
    await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { ...base, partes: 3, participantes: [{ usuarioId: me, participaciones: 1 }] }, 400);
    // Editing into shares keeps the same expense and recalculates exactly.
    await call(`/gastos/${created.id}`, caleb, 'PUT', { montoTotal: 9000, tipoDivision: 'participaciones', participantes: [{ usuarioId: marco, participaciones: 1 }, { usuarioId: ana, participaciones: 2 }, { usuarioId: me, participaciones: 0 }] });
    const edited = Object.fromEntries((await db.gastoParticipante.findMany({ where: { gastoId: created.id } })).map((p) => [p.usuarioId, p.montoAsignado]));
    assert.deepEqual([edited[marco], edited[ana], edited[me] ?? 0], [3000, 6000, 0]);

    // 2. A chain: Andrea paid for Marco; JUNTO Simplifica keeps every net and never adds transfers.
    await call(`/grupos/${group.id}/gastos`, andrea, 'POST', { descripcion: 'Taxi', montoTotal: 4000, pagadoPor: ana, categoria: 'transporte', tipoDivision: 'exacto', participantes: [{ usuarioId: marco, monto: 4000 }] });
    detail = await call(`/grupos/${group.id}`, caleb);
    const nets = (rows) => rows.reduce((map, r) => map.set(r.deudorId, (map.get(r.deudorId) ?? 0) - r.monto).set(r.acreedorId, (map.get(r.acreedorId) ?? 0) + r.monto), new Map());
    const direct = nets(detail.resumen.deudasDirectas); const plan = nets(detail.resumen.saldos);
    for (const a of detail.resumen.cuentas) {
      assert.equal(direct.get(a.usuarioId) ?? 0, a.neto);
      assert.equal(plan.get(a.usuarioId) ?? 0, a.neto);
    }
    assert.ok(detail.resumen.saldos.length <= detail.resumen.deudasDirectas.length);
    assert.deepEqual(detail.resumen.porCategoria.map((c) => [c.categoria, c.monto, c.cantidad]), [['comida', 9000, 1], ['transporte', 4000, 1]]);

    // 3. Marco (added by name) pays Caleb S/ 30 in cash; Andrea reports S/ 10 by Yape and Caleb
    //    confirms it twice: the second answer is rejected and the ledger counts it once.
    await call('/pagos/recibido', caleb, 'POST', { grupoId: group.id, pagadorId: marco, monto: 3000, metodo: 'efectivo' });
    detail = await call(`/grupos/${group.id}`, caleb);
    const owedBefore = detail.resumen.cuentas.find((a) => a.usuarioId === ana).neto;
    if (owedBefore < 0) {
      const pago = await call('/pagos/reportar', andrea, 'POST', { grupoId: group.id, receptorId: detail.resumen.saldos.find((s) => s.deudorId === ana).acreedorId, monto: Math.min(1000, -owedBefore), metodo: 'yape' });
      const receiver = pago.receptorId === me ? caleb : andrea;
      await call(`/pagos/${pago.id}/confirmar`, receiver, 'POST', {});
      await call(`/pagos/${pago.id}/confirmar`, receiver, 'POST', {}, 400);
      const after = (await call(`/grupos/${group.id}`, caleb)).resumen.cuentas.find((a) => a.usuarioId === ana).neto;
      assert.equal(after, owedBefore + Math.min(1000, -owedBefore), 'a payment confirmed twice counts once');
    }
    const finalDetail = await call(`/grupos/${group.id}`, caleb);
    assert.equal(finalDetail.resumen.cuentas.reduce((sum, a) => sum + a.neto, 0), 0, 'money is neither created nor lost');
    // 4. Person to person (default for new groups): the owner's example. Sofía pays lunch 200, Ana fuel 80.
    const sofia = await account('Sofía QA', 'sofia');
    const anaP = await account('Ana Pareja QA', 'anap');
    const trip = await call('/grupos', sofia, 'POST', { nombre: `Lunahuaná ${suffix}`, tipo: 'viaje', integrantes: ['Ana', 'Luis', 'Marta'] });
    let tripDetail = await call(`/grupos/${trip.id}`, sofia);
    assert.equal(tripDetail.simplificarDeudas, false, 'new groups go person to person');
    const code = (await db.grupoMiembro.findFirst({ where: { grupoId: trip.id, usuario: { nombre: 'Ana', sinCuenta: true } }, select: { codigoPersonal: true } })).codigoPersonal;
    await call('/grupos/unirse', anaP, 'POST', { link: code });
    tripDetail = await call(`/grupos/${trip.id}`, sofia);
    const everyoneTrip = tripDetail.miembros.map((m) => ({ usuarioId: m.usuarioId }));
    await call(`/grupos/${trip.id}/gastos`, sofia, 'POST', { descripcion: 'Almuerzo', montoTotal: 20000, pagadoPor: sofia.usuario.id, tipoDivision: 'igual', categoria: 'comida', participantes: everyoneTrip });
    await call(`/grupos/${trip.id}/gastos`, anaP, 'POST', { descripcion: 'Gasolina', montoTotal: 8000, pagadoPor: anaP.usuario.id, tipoDivision: 'igual', categoria: 'transporte', participantes: everyoneTrip });
    const anaView = await call(`/grupos/${trip.id}`, anaP);
    assert.deepEqual(anaView.resumen.saldos.filter((s) => s.deudorId === anaP.usuario.id).map((s) => [s.acreedorId, s.monto]), [[sofia.usuario.id, 3000]]);
    assert.deepEqual([anaView.balanceUsuario.teDeben, anaView.balanceUsuario.debes], [4000, 3000], 'Ana is owed 40 and owes 30: both shown');
    await call('/pagos/reportar', anaP, 'POST', { grupoId: trip.id, receptorId: sofia.usuario.id, monto: 3001, metodo: 'yape' }, 400);
    const anaPays = await call('/pagos/reportar', anaP, 'POST', { grupoId: trip.id, receptorId: sofia.usuario.id, monto: 3000, metodo: 'yape' });
    await call(`/grupos/${trip.id}`, sofia, 'PUT', { simplificarDeudas: true }, 409);
    await call(`/pagos/${anaPays.id}/confirmar`, sofia, 'POST', {});
    const settled = await call(`/grupos/${trip.id}`, sofia);
    assert.equal(settled.resumen.saldos.some((s) => s.deudorId === anaP.usuario.id), false, 'Ana settled with Sofía');
    assert.equal(settled.resumen.saldos.filter((s) => s.acreedorId === sofia.usuario.id).reduce((t, s) => t + s.monto, 0), 10000);
    // The admin may switch to the fewest payments afterwards; every net balance stays the same.
    const switched = await call(`/grupos/${trip.id}`, sofia, 'PUT', { simplificarDeudas: true });
    assert.equal(switched.resumen.simplificado, true);
    const byPerson = (cuentas) => Object.fromEntries(cuentas.map((a) => [a.usuarioId, a.neto]));
    assert.deepEqual(byPerson(switched.resumen.cuentas), byPerson(settled.resumen.cuentas));
    console.log('PASS: shares split exact to the cent (create and edit, invalid shares rejected), replaced name-only member hidden, direct and simplified debts keep every net, spending by category, double confirmation counted once; person to person by default (Ana owes Sofía 30, pays it, over-payment refused, mode locked while a payment is pending, switch keeps every net). Local data only.');
  } catch (error) {
    console.error(server.log().split(String.fromCharCode(10)).filter((line) => /error/i.test(line)).slice(-8).join(String.fromCharCode(10)));
    throw error;
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; });
