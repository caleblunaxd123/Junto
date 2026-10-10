// Local QA only: a "cobranza" group as a chat, for trying the app on an emulator.
// Usage: DATABASE_URL=<local QA db> JUNTO_QA_API=http://localhost:3005/api node ops/seed-chat-demo.cjs
// Fictional accounts (@example.invalid). Credentials go to ops/artifacts/chat-demo-private.json (git-ignored).
const fs = require('node:fs');
const path = require('node:path');
const API = require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const suffix = Date.now().toString(36);
async function call(route, user, method = 'GET', body) {
  const response = await fetch(API.replace(/\/$/, '') + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json();
  if (!response.ok) throw new Error(`${method} ${route}: ${response.status} ${JSON.stringify(data)}`);
  return data;
}
async function person(name) {
  const email = `demo-${name.toLowerCase()}-${suffix}@example.invalid`;
  const password = `Demo${suffix}!x`;
  await call('/auth/register', null, 'POST', { nombre: `${name} Demo`, email, password });
  const user = await db.usuario.findUniqueOrThrow({ where: { email } });
  return { email, password, ...await call('/auth/verify-email', null, 'POST', { email, otp: user.otpCode }) };
}
(async () => {
  const [caleb, ana, luis, marta] = [await person('Caleb'), await person('Ana'), await person('Luis'), await person('Marta')];
  const deadline = new Date(Date.now() + 2 * 86_400_000); deadline.setHours(23, 59, 0, 0);
  const group = await call('/grupos', caleb, 'POST', { nombre: 'Cine del viernes', tipo: 'amigos', modo: 'cobranza', aprobacionPagos: 'administrador', cuenta: { descripcion: 'Entradas y canchita', montoTotal: 50000, partes: 5 }, fechaLimite: deadline.toISOString() });
  for (const p of [ana, luis, marta]) await call('/grupos/unirse', p, 'POST', { link: group.linkInvitacion });
  await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: '¡Listo! Ya compré las 5 entradas 🎬 Cada uno me devuelve S/ 100 por Yape' });
  const paid = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: caleb.usuario.id, monto: 10000, metodo: 'yape' });
  await call(`/pagos/${paid.id}/confirmar`, caleb, 'POST');
  await call(`/grupos/${group.id}/mensajes`, ana, 'POST', { texto: 'Te yapeé, gracias Caleb 🙌' });
  await call('/pagos/reportar', luis, 'POST', { grupoId: group.id, receptorId: caleb.usuario.id, monto: 5000, metodo: 'plin' });
  await call(`/grupos/${group.id}/mensajes`, luis, 'POST', { texto: 'Te pasé la mitad por Plin, el resto el viernes' });
  const division = await call('/grupos', ana, 'POST', { nombre: 'Regalo para mamá', modo: 'division', cuenta: { montoTotal: 30000, partes: 3 } });
  await call('/grupos/unirse', caleb, 'POST', { link: division.linkInvitacion });
  const out = path.join(__dirname, 'artifacts', 'chat-demo-private.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ groupId: group.id, link: group.linkInvitacion, accounts: Object.fromEntries(Object.entries({ caleb, ana, luis, marta }).map(([k, v]) => [k, { email: v.email, password: v.password }])) }, null, 2));
  console.log(`Demo ready: group ${group.id}. Credentials written to ${out}`);
  await db.$disconnect();
})().catch(async (error) => { console.error(error.message); await db.$disconnect(); process.exitCode = 1; });
