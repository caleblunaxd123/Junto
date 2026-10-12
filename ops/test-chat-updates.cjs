// Fresh local QA only: newest chat migrations, no real users/messages/photos.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
require('./local-qa.cjs').localQa();
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();
async function run() {
  const server = startApi(3043, {});
  try {
    await server.ready;
    async function user(name) {
      const u = await db.usuario.create({ data: { nombre: name, email: `${randomUUID()}@example.invalid`, emailVerificado: true, passwordHash: '!' } });
      return { id: u.id, token: jwt.sign({ userId: u.id, credentialsTag: credentialsTag(u.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '10m' }) };
    }
    const owner = await user('Chat QA'), member = await user('Ana Chat QA'), outsider = await user('Fuera Chat QA');
    async function call(path, who, method = 'GET', body, status = 200) {
      const r = await fetch('http://127.0.0.1:3043/api' + path, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: body ? JSON.stringify(body) : undefined });
      const data = r.status === 204 ? null : await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data;
    }
    const imageBytes = require('node:fs').readFileSync(require('node:path').join(__dirname, 'qa-voucher.png'));
    await call('/auth/me/foto', owner, 'PUT', { imagen: 'not-an-image' }, 400);
    const photo = await call('/auth/me/foto', owner, 'PUT', { imagen: imageBytes.toString('base64') });
    const photoResponse = await fetch('http://127.0.0.1:3043' + photo.fotoUrl);
    assert.equal(photoResponse.status, 200);
    assert.equal(photoResponse.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await photoResponse.arrayBuffer()), imageBytes);
    assert.equal((await call('/auth/me', member)).fotoUrl, null, 'Another member photo stays unchanged');
    const replacement = await call('/auth/me/foto', owner, 'PUT', { imagen: imageBytes.toString('base64') });
    assert.notEqual(replacement.fotoUrl, photo.fotoUrl);
    assert.equal((await fetch('http://127.0.0.1:3043' + photo.fotoUrl)).status, 404);
    await call('/auth/me/foto', owner, 'DELETE');
    assert.equal((await fetch('http://127.0.0.1:3043' + replacement.fotoUrl)).status, 404);
    assert.equal((await call('/auth/me', owner)).fotoUrl, null);
    const group = await call('/grupos', owner, 'POST', { nombre: 'Chat de prueba', integrantes: ['Invitado'] }, 201);
    await call('/grupos/unirse', member, 'POST', { link: group.linkInvitacion });
    const first = await call(`/grupos/${group.id}/mensajes`, owner, 'POST', { texto: 'Primera pregunta' }, 201);
    const second = await call(`/grupos/${group.id}/mensajes`, owner, 'POST', { texto: 'Segunda pregunta' }, 201);
    const answer = await call(`/grupos/${group.id}/mensajes`, member, 'POST', { texto: 'Sí', respondeA: first.id }, 201);
    const different = await call(`/grupos/${group.id}/mensajes`, member, 'POST', { texto: 'Sí', respondeA: second.id }, 201);
    assert.notEqual(answer.id, different.id, 'Same text replying to different messages is not a duplicate');
    assert.equal((await call(`/grupos/${group.id}/mensajes`, member, 'POST', { texto: 'Sí', respondeA: second.id })).id, different.id);
    await call(`/comentarios/${first.id}/reaccion`, member, 'POST', { emoji: '👍' });
    await call(`/comentarios/${first.id}/reaccion`, outsider, 'POST', { emoji: '👍' }, 404);
    assert.equal((await call(`/comentarios/${first.id}/reaccion`, member, 'POST', { emoji: '👍' })).emoji, null);
    await call(`/grupos/${group.id}/fijar`, member, 'POST', { comentarioId: first.id });
    await call(`/grupos/${group.id}/fijar`, outsider, 'POST', { comentarioId: first.id }, 403);
    await call(`/grupos/${group.id}/presencia`, owner);
    await call(`/grupos/${group.id}/presencia`, outsider, 'GET', undefined, 403);
    const chat = await call(`/grupos/${group.id}/chat`, member);
    assert.equal(chat.find(e => e.comentarioId === different.id).respuesta.comentarioId, second.id);
    const other = await call('/grupos', owner, 'POST', { nombre: 'Otro chat' }, 201);
    await call(`/grupos/${other.id}/mensajes`, owner, 'POST', { texto: 'Fuera de grupo', respondeA: first.id }, 404);
    await call(`/comentarios/${first.id}`, owner, 'DELETE', undefined, 204);
    const after = await call(`/grupos/${group.id}/chat`, member);
    assert.equal(after.find(e => e.comentarioId === answer.id).respuesta.texto, '');
    assert.equal((await db.grupo.findUnique({ where: { id: group.id } })).mensajeFijadoId, null);
    console.log('PASS latest chat: reply ownership/context, dedup, erased quotes, member reactions/pin/presence and outsider refusal. No external messages.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch(e => { console.error(e.stack); process.exitCode = 1; });
