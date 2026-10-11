// Local QA only: a group with people added by name and the three typical cases, for the emulator.
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
  const data = response.status === 204 ? null : await response.json();
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
  // Caleb has the app; Ana, Luis, Marta and Pedro (the birthday boy) are added by name.
  const [caleb, ana] = [await person('Caleb'), await person('Ana')];
  const group = await call('/grupos', caleb, 'POST', { nombre: 'Paseo a Lunahuaná', tipo: 'viaje', aprobacionPagos: 'administrador', integrantes: ['Ana', 'Luis', 'Marta', 'Pedro'] });
  let detail = await call(`/grupos/${group.id}`, caleb);
  const id = (nombre) => detail.miembros.find((m) => m.usuario.nombre === nombre).usuarioId;
  const four = [caleb.usuario.id, id('Ana'), id('Luis'), id('Marta')];
  await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Entradas al canotaje', montoTotal: 30000, pagadoPor: caleb.usuario.id, categoria: 'entretenimiento', participantes: four.map((usuarioId) => ({ usuarioId })) });
  await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Almuerzo del cumple de Pedro', montoTotal: 20000, pagadoPor: id('Ana'), categoria: 'comida', participantes: four.map((usuarioId) => ({ usuarioId })) });
  await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Taxi al hotel', montoTotal: 4000, pagadoPor: id('Luis'), categoria: 'transporte', participantes: [caleb.usuario.id, id('Marta')].map((usuarioId) => ({ usuarioId })) });
  await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'Anoté las entradas, el almuerzo y el taxi 🙌 Pedro no paga, ¡es su cumple!' });
  detail = await call(`/grupos/${group.id}`, caleb);
  const anaCode = detail.miembros.find((m) => m.usuario.nombre === 'Ana').codigoPersonal;
  const out = path.join(__dirname, 'artifacts', 'chat-demo-private.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ groupId: group.id, link: group.linkInvitacion, anaPersonalCode: anaCode, accounts: { caleb: { email: caleb.email, password: caleb.password }, ana: { email: ana.email, password: ana.password } } }, null, 2));
  console.log(`Demo ready: group ${group.id}. Credentials written to ${out}`);
  await db.$disconnect();
})().catch(async (error) => { console.error(error.message); await db.$disconnect(); process.exitCode = 1; });
