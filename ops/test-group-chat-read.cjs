const { test } = require('node:test');
const assert = require('node:assert/strict');
// This is a mocked unit test: never inherit a developer's database connection.
process.env.DATABASE_URL = 'postgresql://unit:unit@127.0.0.1:1/junto_qa_unit';
require('ts-node').register({ transpileOnly: true, compilerOptions: { module: 'CommonJS', moduleResolution: 'node' } });
const { prisma } = require('../apps/api/src/lib/prisma.ts');
const { getGroupChat, unreadInGroup } = require('../apps/api/src/services/groupChat.service.ts');

test('read cursor cannot skip an event arriving during the request or rewind after a concurrent request', async () => {
  const person = { id: 'owner', nombre: 'Owner', fotoUrl: null };
  let saved, arrived;
  prisma.grupoMiembro.findFirst = async () => ({ rol: 'admin', grupo: { creadoPor: 'owner', fechaCreacion: new Date(0), creador: person, aprobacionPagos: 'receptor' } });
  for (const model of ['grupoMiembro', 'avisoGrupo', 'gasto', 'pago', 'recordatorio', 'eventoGrupo']) prisma[model].findMany = async () => [];
  prisma.comentario.findMany = async () => {
    await new Promise(resolve => setTimeout(resolve, 20));
    arrived = new Date();
    return [{ id: 'message', fechaCreacion: arrived, autor: person, autorId: 'owner', texto: 'new', eliminado: false, reacciones: [] }];
  };
  prisma.grupoMiembro.updateMany = async (args) => { saved = args; return { count: 1 }; };
  await getGroupChat('owner', 'group');
  assert.ok(saved.data.ultimaLectura < arrived, 'a later event remains unread rather than being skipped');
  assert.deepEqual(saved.where.OR, [{ ultimaLectura: null }, { ultimaLectura: { lt: saved.data.ultimaLectura } }]);
});

test('a resolution is unread for the payer, never for its own resolver; one payment counts once', async () => {
  let query;
  for (const model of ['comentario', 'gasto', 'grupoMiembro', 'eventoGrupo']) prisma[model].count = async () => 0;
  prisma.pago.count = async (args) => { query = args; return 1; };
  const since = new Date(0);
  assert.equal(await unreadInGroup('group', 'payer', since), 1);
  assert.deepEqual(query.where.OR, [
    // A payment the receiver recorded themself ("Ya me pagó") is not news to them.
    { pagadorId: { not: 'payer' }, fechaPago: { gt: since }, OR: [{ resueltoPor: null }, { resueltoPor: { not: 'payer' } }] },
    { resueltoPor: { not: 'payer' }, fechaResolucion: { gt: since } },
  ]);
});

test('names added without an account are not counted as someone joining', async () => {
  let query;
  for (const model of ['comentario', 'gasto', 'pago', 'eventoGrupo']) prisma[model].count = async () => 0;
  prisma.grupoMiembro.count = async (args) => { query = args; return 0; };
  await unreadInGroup('group', 'me', new Date(0));
  assert.deepEqual(query.where.usuario, { sinCuenta: false });
});
