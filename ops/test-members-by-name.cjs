// Local fictional accounts only, loopback SMTP, never contacts friends or production.
// Usage: DATABASE_URL=<local QA db> node ops/test-members-by-name.cjs   (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
async function run() {
  const smtp = await helpers.startSmtp();
  const server = helpers.startApi(3034, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'qa@example.invalid', SMTP_PASS: 'fictional-only', SMTP_ALLOW_INSECURE_LOCAL: 'true', EMAIL_FROM: 'JUNTO <qa@example.invalid>' });
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body, status = 200) {
      const response = await fetch('http://127.0.0.1:3034/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json();
      assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function person(name) {
      const email = `qa-names-${name.toLowerCase()}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre: name + ' QA', email, password: `NamesQA${suffix}!` }, 201);
      const user = await db.usuario.findUniqueOrThrow({ where: { email } });
      return { email, ...await call('/auth/verify-email', null, 'POST', { email, otp: user.otpCode }) };
    }
    const [caleb, luisReal, anaReal, martaReal, stranger] = await Promise.all(['Caleb', 'Luis', 'Ana', 'Marta', 'Otro'].map(person));
    const detail = (user, id) => call(`/grupos/${id}`, user);
    const byName = (g, nombre) => g.miembros.find((m) => m.usuario.nombre === nombre);
    const account = (g, id) => g.resumen.cuentas.find((a) => a.usuarioId === id);

    // 1. Caleb paid S/ 300 for four, before anyone has the app: he adds them by name right away.
    await call('/grupos', caleb, 'POST', { nombre: 'Duplicados', integrantes: ['Ana', 'ana'] }, 409);
    const group = await call('/grupos', caleb, 'POST', { nombre: `Paseo ${suffix}`, integrantes: ['Ana', 'Luis', 'Marta', 'Pedro'] }, 201);
    let g = await detail(caleb, group.id);
    assert.equal(g.miembros.length, 5);
    const [ana, luis, marta, pedro] = ['Ana', 'Luis', 'Marta', 'Pedro'].map((n) => byName(g, n));
    assert.ok([ana, luis, marta, pedro].every((m) => m.usuario.sinCuenta && m.codigoPersonal));
    await call(`/grupos/${group.id}/integrantes`, caleb, 'POST', { nombres: ['Luis'] }, 409);
    await call(`/grupos/${group.id}/integrantes`, stranger, 'POST', { nombres: ['Intruso'] }, 403);
    const extra = (await call(`/grupos/${group.id}/integrantes`, caleb, 'POST', { nombres: ['Sobrante'] }, 201))[0];
    await call(`/grupos/${group.id}/integrantes/${extra.id}`, caleb, 'DELETE', undefined, 204);

    const four = [caleb.usuario.id, ana.usuarioId, luis.usuarioId, marta.usuarioId];
    await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Entradas', montoTotal: 30000, pagadoPor: caleb.usuario.id, participantes: four.map((usuarioId) => ({ usuarioId })) }, 201);
    g = await detail(caleb, group.id);
    assert.equal(g.balanceUsuario.teDeben, 22500, 'Caleb recovers 225, three people owe 75');
    assert.equal(account(g, marta.usuarioId).neto, -7500);

    // 2. Birthday lunch: Ana paid S/ 200; Pedro (the birthday boy) pays nothing, four people share it.
    await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Almuerzo del cumple', montoTotal: 20000, pagadoPor: ana.usuarioId, participantes: four.map((usuarioId) => ({ usuarioId })) }, 201);
    g = await detail(caleb, group.id);
    assert.equal(account(g, pedro.usuarioId).tuParte, 0, 'the birthday boy pays nothing');
    assert.equal(account(g, ana.usuarioId).neto, -7500 + 15000, 'Ana: paid 200, her share 50, owes 75 for the tickets');

    // 3. Trip: Luis paid the taxi S/ 40 for Caleb and Marta.
    await call(`/grupos/${group.id}/gastos`, caleb, 'POST', { descripcion: 'Taxi', montoTotal: 4000, pagadoPor: luis.usuarioId, participantes: [caleb.usuario.id, marta.usuarioId].map((usuarioId) => ({ usuarioId })) }, 201);
    g = await detail(caleb, group.id);
    const total = g.resumen.totalGastado;
    assert.equal(total, 54000);
    assert.equal(g.resumen.cuentas.reduce((sum, a) => sum + a.neto, 0), 0, 'the ledger always balances');

    // 4. Names only: no login, no reminders by app; e-mails never go out.
    const placeholder = await db.usuario.findUniqueOrThrow({ where: { id: marta.usuarioId } });
    assert.match(placeholder.email, /@junto\.invalid$/);
    await call('/auth/login', null, 'POST', { email: placeholder.email, password: '!' }, 401);
    await call('/auth/forgot-password', null, 'POST', { email: placeholder.email });
    assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: marta.usuarioId } })).otpCode, null);
    await call(`/grupos/${group.id}/recordar`, caleb, 'POST', { deudorId: marta.usuarioId }, 409);

    // 5. Caleb records what Marta gave him in cash: confirmed at once, never more than she owes.
    const martaOwesCaleb = g.saldos.filter((s) => s.deudorId === marta.usuarioId && s.acreedorId === caleb.usuario.id).reduce((sum, s) => sum + s.monto, 0);
    assert.ok(martaOwesCaleb > 0);
    await call('/pagos/recibido', caleb, 'POST', { grupoId: group.id, pagadorId: marta.usuarioId, monto: martaOwesCaleb + 1, metodo: 'efectivo' }, 400);
    await call('/pagos/recibido', stranger, 'POST', { grupoId: group.id, pagadorId: marta.usuarioId, monto: 100, metodo: 'efectivo' }, 400);
    const cash = await call('/pagos/recibido', caleb, 'POST', { grupoId: group.id, pagadorId: marta.usuarioId, monto: 2000, metodo: 'efectivo' }, 201);
    assert.equal(cash.estado, 'exitoso');
    const before = account(await detail(caleb, group.id), marta.usuarioId).neto;

    // 6. Luis joins with the shared link and says he is "Luis"? He is owed the taxi: not allowed.
    const shared = group.linkInvitacion;
    const preview = await call(`/grupos/invitacion/${shared}`, luisReal);
    assert.deepEqual(preview.sinApp.map((p) => p.nombre).sort(), ['Marta', 'Pedro'], 'only people who owe (or nothing) can be chosen with the shared link');
    await call('/grupos/unirse', stranger, 'POST', { link: shared, como: luis.usuarioId }, 403);
    // ...but with his personal link he becomes Luis, credit included.
    const personalPreview = await call(`/grupos/invitacion/${luis.codigoPersonal}`, luisReal);
    assert.equal(personalPreview.personal.nombre, 'Luis');
    // Paid the S/ 40 taxi but owes S/ 75 (tickets) + S/ 50 (lunch): S/ 85 net, shown before joining.
    assert.deepEqual({ debes: personalPreview.personal.debes, teDeben: personalPreview.personal.teDeben }, { debes: 8500, teDeben: 0 });
    await call('/grupos/unirse', luisReal, 'POST', { link: luis.codigoPersonal });
    await call('/grupos/unirse', stranger, 'POST', { link: luis.codigoPersonal }, 400);
    g = await detail(caleb, group.id);
    assert.ok(!byName(g, 'Luis'), 'the name-only Luis left the group');
    assert.equal(account(g, luisReal.usuario.id).pagaste, 4000, 'the real Luis inherited the taxi he paid');
    assert.equal(g.resumen.totalGastado, total, 'taking over a name never changes totals');

    // 7. Marta joins with the shared link choosing her name: she inherits debt and her cash payment.
    await call('/grupos/unirse', martaReal, 'POST', { link: shared, como: marta.usuarioId });
    g = await detail(martaReal, group.id);
    assert.equal(account(g, martaReal.usuario.id).neto, before);
    assert.equal(g.balanceUsuario.debes, -before);
    // Now she can report her own payment by app.
    await call('/pagos/reportar', martaReal, 'POST', { grupoId: group.id, receptorId: caleb.usuario.id, monto: 1000, metodo: 'yape' }, 201);

    // 8. Ana joins with the shared link as a new person; an admin links her to the name "Ana" afterwards.
    await call('/grupos/unirse', anaReal, 'POST', { link: shared });
    await call(`/grupos/${group.id}/integrantes/${ana.usuarioId}/unir`, martaReal, 'POST', { usuarioId: anaReal.usuario.id }, 403);
    await call(`/grupos/${group.id}/integrantes/${ana.usuarioId}/unir`, caleb, 'POST', { usuarioId: anaReal.usuario.id });
    g = await detail(caleb, group.id);
    assert.equal(account(g, anaReal.usuario.id).pagaste, 20000, 'the real Ana paid the lunch');
    assert.equal(g.resumen.totalGastado, total);
    assert.equal(g.resumen.cuentas.reduce((sum, a) => sum + a.neto, 0), 0);
    // Pedro (birthday) still a name; someone involved in expenses cannot simply be removed.
    await call(`/grupos/${group.id}/integrantes/${pedro.usuarioId}`, caleb, 'DELETE', undefined, 204);
    await call(`/grupos/${group.id}/integrantes/${marta.usuarioId}`, caleb, 'DELETE', undefined, 404);

    // Presence: members see who is online; people added by name have none; outsiders see nothing.
    const presence = await call(`/grupos/${group.id}/presencia`, caleb);
    assert.equal(presence.find((p) => p.usuarioId === caleb.usuario.id).enLinea, true, 'whoever is using the app is online');
    assert.ok(!presence.some((p) => p.usuarioId === pedro.usuarioId), 'names without an account have no presence');
    assert.deepEqual(Object.keys(presence[0]).sort(), ['enLinea', 'ultimaConexion', 'usuarioId']);
    await call(`/grupos/${group.id}/presencia`, stranger, 'GET', undefined, 403);

    // Chat like WhatsApp: ticks on what I post, one reaction per person, one pinned message.
    const sent = await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'Recuerden yapearme hoy 🙏' }, 201);
    const myMessage = async () => (await call(`/grupos/${group.id}/chat`, caleb)).find((i) => i.comentarioId === sent.id);
    assert.notEqual((await myMessage()).entrega, 'visto', 'nobody has opened the chat yet');
    for (const p of [luisReal, martaReal, anaReal]) await call(`/grupos/${group.id}/chat`, p);
    assert.equal((await myMessage()).entrega, 'visto', 'everyone with the app opened the chat after it');
    await call(`/comentarios/${sent.id}/reaccion`, martaReal, 'POST', { emoji: '💩' }, 400);
    await call(`/comentarios/${sent.id}/reaccion`, martaReal, 'POST', { emoji: '👍' });
    await call(`/comentarios/${sent.id}/reaccion`, luisReal, 'POST', { emoji: '👍' });
    await call(`/comentarios/${sent.id}/reaccion`, anaReal, 'POST', { emoji: '❤️' });
    assert.deepEqual((await myMessage()).reacciones, [{ emoji: '👍', total: 2, mia: false }, { emoji: '❤️', total: 1, mia: false }]);
    await call(`/comentarios/${sent.id}/reaccion`, martaReal, 'POST', { emoji: '👍' });
    assert.deepEqual((await myMessage()).reacciones.map((r) => [r.emoji, r.total]), [['👍', 1], ['❤️', 1]], 'the same emoji again removes it');
    await call(`/grupos/${group.id}/fijar`, stranger, 'POST', { comentarioId: sent.id }, 403);
    await call(`/grupos/${group.id}/fijar`, martaReal, 'POST', { comentarioId: sent.id });
    assert.equal((await detail(caleb, group.id)).mensajeFijado.id, sent.id);
    assert.equal((await myMessage()).fijado, true);
    await call(`/comentarios/${sent.id}`, caleb, 'DELETE', undefined, 204);
    assert.equal((await detail(caleb, group.id)).mensajeFijado, null, 'a deleted message is unpinned');

    // Replies quote a live message of the same group chat.
    const question = await call(`/grupos/${group.id}/mensajes`, luisReal, 'POST', { texto: '¿Cuánto era lo del almuerzo?' }, 201);
    const answer = await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'S/ 36 cada uno', respondeA: question.id }, 201);
    const quoted = (await call(`/grupos/${group.id}/chat`, martaReal)).find((i) => i.comentarioId === answer.id).respuesta;
    assert.equal(quoted.comentarioId, question.id);
    assert.equal(quoted.texto, '¿Cuánto era lo del almuerzo?');
    assert.equal(quoted.autor.id, luisReal.usuario.id);
    const other = await call('/grupos', stranger, 'POST', { nombre: `Otro ${suffix}`, integrantes: ['X'] }, 201);
    const elsewhere = await call(`/grupos/${other.id}/mensajes`, stranger, 'POST', { texto: 'De otro grupo' }, 201);
    await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'No se puede', respondeA: elsewhere.id }, 404);
    await call(`/comentarios/${question.id}`, luisReal, 'DELETE', undefined, 204);
    await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'Tampoco', respondeA: question.id }, 404);
    assert.equal((await call(`/grupos/${group.id}/chat`, caleb)).find((i) => i.comentarioId === answer.id).respuesta.eliminado, true, 'the quote of a deleted message stays, without its text');

    // Profile photo: upload, shown next to my messages, public by random id, replaced and removed.
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    await call('/auth/me/foto', caleb, 'PUT', { imagen: 'bm90IGFuIGltYWdl' }, 400);
    const first = await call('/auth/me/foto', caleb, 'PUT', { imagen: png });
    assert.match(first.fotoUrl, /^\/api\/fotos\/[0-9a-f-]{36}$/);
    const photo = await fetch(`http://127.0.0.1:3034${first.fotoUrl}`);
    assert.equal(photo.status, 200);
    assert.equal(photo.headers.get('content-type'), 'image/png');
    assert.match(photo.headers.get('cache-control'), /immutable/);
    const note = await call(`/grupos/${group.id}/mensajes`, caleb, 'POST', { texto: 'Con foto' }, 201);
    assert.equal((await call(`/grupos/${group.id}/chat`, luisReal)).find((i) => i.comentarioId === note.id).autor.fotoUrl, first.fotoUrl);
    const second = await call('/auth/me/foto', caleb, 'PUT', { imagen: png });
    assert.notEqual(second.fotoUrl, first.fotoUrl, 'a new upload gets a new URL');
    assert.equal((await fetch(`http://127.0.0.1:3034${first.fotoUrl}`)).status, 404, 'the old photo is gone');
    assert.equal((await call('/auth/me/foto', caleb, 'DELETE')).fotoUrl, null);
    assert.equal((await fetch(`http://127.0.0.1:3034${second.fotoUrl}`)).status, 404);
    assert.equal((await fetch('http://127.0.0.1:3034/api/fotos/no-es-uuid')).status, 404);

    // 9. The last person with an account leaving closes the group; admin never goes to a name.
    const solo = await call('/grupos', stranger, 'POST', { nombre: `Solo ${suffix}`, integrantes: ['Nadie'] }, 201);
    await call(`/grupos/${solo.id}/salir`, stranger, 'DELETE');
    assert.equal((await db.grupo.findUniqueOrThrow({ where: { id: solo.id } })).activo, false);

    console.log('PASS: members by name at creation, S/ 300 split, birthday excluded, trip with several payers, no login/OTP/reminders for names, cash recorded by receiver (capped), shared link may only claim people who owe, personal link claims credit once, admin linking, removal rules, totals constant. No external sends.');
  } finally { server.child.kill(); smtp.close(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
