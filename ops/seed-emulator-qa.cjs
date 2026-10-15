// LOCAL QA for the emulator: a fictional account with the "Viaje a Cusco" and "Depa Miraflores" groups
// (same data as ops/ux-previews.cjs) on a loopback API. Prints the fictional login to the terminal only.
// Usage: JUNTO_QA_API=http://localhost:3005/api DATABASE_URL=<local QA db> node ops/seed-emulator-qa.cjs
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const origin = require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const suffix = Date.now().toString(36);

async function run() {
  async function call(route, user, method = 'GET', body) {
    const response = await fetch(origin + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    const data = response.status === 204 ? null : await response.json();
    assert.ok(response.ok, `${method} ${route}: ${JSON.stringify(data)}`);
    return data;
  }
  async function account(nombre, slug) {
    const email = `qa${slug}${suffix}@example.invalid`;
    const password = `Qa${crypto.randomBytes(6).toString('hex')}9`;
    await call('/auth/register', null, 'POST', { nombre, email, password });
    const { otpCode } = await db.usuario.findUniqueOrThrow({ where: { email } });
    return { email, password, ...(await call('/auth/verify-email', null, 'POST', { email, otp: otpCode })) };
  }
  const caleb = await account('Caleb Luna', 'c');
  const ana = await account('Andrea Ríos', 'a');
  const id = (user) => user.usuario.id;
  const trip = await call('/grupos', caleb, 'POST', { nombre: 'Viaje a Cusco', tipo: 'viaje', integrantes: ['Andrea', 'Marco', 'Lucía'] });
  let detail = await call(`/grupos/${trip.id}`, caleb);
  const byName = (group, name) => group.miembros.find((m) => m.usuario.nombre.startsWith(name)).usuarioId;
  await call('/grupos/unirse', ana, 'POST', { link: trip.linkInvitacion, como: byName(detail, 'Andrea') });
  detail = await call(`/grupos/${trip.id}`, caleb);
  const everyone = detail.miembros.map((m) => ({ usuarioId: m.usuarioId }));
  const marco = byName(detail, 'Marco'); const lucia = byName(detail, 'Luc');
  const expense = (user, body) => call(`/grupos/${trip.id}/gastos`, user, 'POST', { tipoDivision: 'igual', participantes: everyone, ...body });
  await expense(caleb, { descripcion: 'Hotel en San Blas', montoTotal: 64000, pagadoPor: id(caleb), categoria: 'alojamiento' });
  await expense(ana, { descripcion: 'Tour Valle Sagrado', montoTotal: 20000, pagadoPor: id(ana), categoria: 'entretenimiento' });
  await expense(caleb, { descripcion: 'Cena en Pachapapa', montoTotal: 18000, pagadoPor: marco, categoria: 'comida', participantes: [{ usuarioId: id(caleb) }, { usuarioId: id(ana) }, { usuarioId: marco }] });
  await expense(caleb, { descripcion: 'Taxi al aeropuerto', montoTotal: 6000, pagadoPor: id(caleb), categoria: 'transporte' });
  await call('/pagos/reportar', ana, 'POST', { grupoId: trip.id, receptorId: id(caleb), monto: 5000, metodo: 'yape' });
  await call('/pagos/recibido', caleb, 'POST', { grupoId: trip.id, pagadorId: lucia, monto: 10000, metodo: 'efectivo' });
  const depa = await call('/grupos', caleb, 'POST', { nombre: 'Depa Miraflores', tipo: 'roomies', integrantes: ['Sofía', 'Diego'] });
  const depaDetail = await call(`/grupos/${depa.id}`, caleb);
  await call(`/grupos/${depa.id}/gastos`, caleb, 'POST', { descripcion: 'Internet de octubre', montoTotal: 12000, pagadoPor: byName(depaDetail, 'Sofía'), tipoDivision: 'igual', categoria: 'otro', participantes: depaDetail.miembros.map((m) => ({ usuarioId: m.usuarioId })) });
  console.log(JSON.stringify({ email: caleb.email, password: caleb.password, viaje: trip.id }));
}
run().catch((error) => { console.error(error.stack || error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
