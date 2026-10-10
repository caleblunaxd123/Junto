// Local fictional accounts only, loopback SMTP, never contacts friends or production.
// Usage: DATABASE_URL=<local QA db> node ops/test-bill-parts.cjs   (after `npm run build` in apps/api)
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
async function run() {
  const smtp = await helpers.startSmtp();
  const server = helpers.startApi(3032, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'qa@example.invalid', SMTP_PASS: 'fictional-only', SMTP_ALLOW_INSECURE_LOCAL: 'true', EMAIL_FROM: 'JUNTO <qa@example.invalid>' });
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body, status = 200) {
      const response = await fetch('http://127.0.0.1:3032/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function person(name) {
      const email = `qa-parts-${name.toLowerCase()}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre: name + ' QA', email, password: `PartsQA${suffix}!` }, 201);
      const user = await db.usuario.findUniqueOrThrow({ where: { email } });
      return { email, ...await call('/auth/verify-email', null, 'POST', { email, otp: user.otpCode }) };
    }
    const [owner, ana, luis, marta, pedro, sexto] = await Promise.all(['Caleb', 'Ana', 'Luis', 'Marta', 'Pedro', 'Sexto'].map(person));
    const share = (detail, user) => detail.resumen.cuentas.find((a) => a.usuarioId === user.usuario.id);

    // Invalid bills never create a half group.
    const before = await db.grupo.count({ where: { creadoPor: owner.usuario.id } });
    await call('/grupos', owner, 'POST', { nombre: 'Partes de más', cuenta: { montoTotal: 50000, partes: 101 } }, 400);
    await call('/grupos', owner, 'POST', { nombre: 'Partes de más', cuenta: { montoTotal: 3, partes: 5 } }, 400);
    assert.equal(await db.grupo.count({ where: { creadoPor: owner.usuario.id } }), before);
    await call('/grupos/x', owner, 'PUT', { cuenta: { montoTotal: 100, partes: 2 } }, 400);

    // 1. The organizer paid S/ 500 for five people and creates the group with it, alone.
    await call('/grupos', owner, 'POST', { nombre: 'Modo raro', modo: 'junta' }, 400);
    const group = await call('/grupos', owner, 'POST', { nombre: `Cine ${suffix}`, tipo: 'amigos', modo: 'cobranza', cuenta: { montoTotal: 50000, partes: 5 } }, 201);
    let detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.modo, 'cobranza');
    assert.equal(detail.resumen.totalGastado, 50000);
    assert.equal(detail.balanceUsuario.teDeben, 0, 'nobody owes anything before anyone joins');
    assert.deepEqual({ partes: detail.cuenta.partes, parte: detail.cuenta.parte, libres: detail.cuenta.libres }, { partes: 5, parte: 10000, libres: 4 });
    assert.equal(detail.cuenta.descripcion, `Cine ${suffix}`);

    // 2. The invitation says what joining costs.
    const preview = await call(`/grupos/invitacion/${group.linkInvitacion}`, ana);
    assert.deepEqual({ parte: preview.cuenta.parte, libres: preview.cuenta.libres, total: preview.cuenta.montoTotal }, { parte: 10000, libres: 4, total: 50000 });

    // 3. Each person who joins (link or accepted invitation) takes one part; the total never changes.
    const joined = await call('/grupos/unirse', ana, 'POST', { link: group.linkInvitacion });
    assert.equal(joined.parte, 10000);
    await call(`/grupos/${group.id}/invitar`, owner, 'POST', { identificador: luis.email });
    const [invitation] = await call('/invitaciones', luis);
    assert.equal(invitation.cuenta.parte, 10000);
    assert.equal(invitation.cuenta.libres, 3);
    assert.equal((await call(`/invitaciones/${invitation.id}/aceptar`, luis, 'POST')).parte, 10000);
    // Joining twice (link after accepting) never takes a second part.
    await call('/grupos/unirse', luis, 'POST', { link: group.linkInvitacion });
    await Promise.all([marta, pedro].map((p) => call('/grupos/unirse', p, 'POST', { link: group.linkInvitacion })));
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.resumen.totalGastado, 50000);
    assert.equal(detail.cuenta.libres, 0);
    assert.equal(detail.balanceUsuario.teDeben, 40000, 'the organizer recovers 400, not 500');
    for (const p of [ana, luis, marta, pedro]) assert.equal(share(detail, p).tuParte, 10000);
    assert.equal(share(detail, owner).tuParte, 10000);

    // 4. A sixth person finds no free part: nothing moves and the organizer is told.
    assert.equal((await call('/grupos/unirse', sexto, 'POST', { link: group.linkInvitacion })).parte, 0);
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(share(detail, sexto).tuParte, 0);
    const notices = await call('/notificaciones', owner);
    assert.equal(notices.length, 5);
    assert.equal(notices.filter((n) => n.parte === 10000).length, 4);
    assert.equal(notices.find((n) => n.integranteId === sexto.usuario.id).parte, null);

    // 5. Ana returns S/ 100 by Yape: it only counts once the organizer confirms it.
    const payment = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: owner.usuario.id, monto: 10000, metodo: 'yape' }, 201);
    assert.equal((await call(`/grupos/${group.id}`, owner)).balanceUsuario.teDeben, 40000);
    await call(`/pagos/${payment.id}/confirmar`, owner, 'POST');
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.balanceUsuario.teDeben, 30000);
    assert.equal(share(detail, ana).neto, 0);
    assert.equal(detail.resumen.totalGastado, 50000, 'a reimbursement is not a new expense');

    // 6. A bill defined later inside an existing group: current members take parts, the rest stay free.
    const later = await call('/grupos', owner, 'POST', { nombre: `Cumple ${suffix}`, modo: 'division' }, 201);
    assert.equal((await call(`/grupos/invitacion/${later.linkInvitacion}`, ana)).modo, 'division');
    await call('/grupos/unirse', ana, 'POST', { link: later.linkInvitacion });
    await call(`/grupos/${later.id}/gastos`, owner, 'POST', { descripcion: 'Torta y local', montoTotal: 30000, pagadoPor: owner.usuario.id, tipoDivision: 'porcentaje', partes: 3, participantes: [{ usuarioId: owner.usuario.id }] }, 400);
    await call(`/grupos/${later.id}/gastos`, owner, 'POST', { descripcion: 'Torta y local', montoTotal: 30000, pagadoPor: owner.usuario.id, partes: 1, participantes: [{ usuarioId: owner.usuario.id }] }, 400);
    const bill = await call(`/grupos/${later.id}/gastos`, owner, 'POST', { descripcion: 'Torta y local', montoTotal: 30000, pagadoPor: owner.usuario.id, partes: 3, participantes: [{ usuarioId: owner.usuario.id }, { usuarioId: ana.usuario.id }] }, 201);
    detail = await call(`/grupos/${later.id}`, owner);
    assert.deepEqual({ libres: detail.cuenta.libres, ana: share(detail, ana).tuParte, teDeben: detail.balanceUsuario.teDeben }, { libres: 1, ana: 10000, teDeben: 10000 });
    await call('/grupos/unirse', luis, 'POST', { link: later.linkInvitacion });
    assert.equal(share(await call(`/grupos/${later.id}`, owner), luis).tuParte, 10000);

    // 7. Correcting the total keeps the parts; a split changed by hand stops automatic parts.
    await call(`/gastos/${bill.id}`, owner, 'PUT', { montoTotal: 36000, tipoDivision: 'igual', partes: 4, participantes: [owner, ana, luis].map((p) => ({ usuarioId: p.usuario.id })) });
    detail = await call(`/grupos/${later.id}`, owner);
    assert.deepEqual({ libres: detail.cuenta.libres, parte: detail.cuenta.parte, luis: share(detail, luis).tuParte }, { libres: 1, parte: 9000, luis: 9000 });
    await call(`/gastos/${bill.id}`, owner, 'PUT', { montoTotal: 36000, tipoDivision: 'exacto', participantes: [{ usuarioId: owner.usuario.id, monto: 6000 }, { usuarioId: ana.usuario.id, monto: 15000 }, { usuarioId: luis.usuario.id, monto: 15000 }] });
    detail = await call(`/grupos/${later.id}`, owner);
    assert.equal(detail.cuenta, null);
    await call('/grupos/unirse', marta, 'POST', { link: later.linkInvitacion });
    assert.equal(share(await call(`/grupos/${later.id}`, owner), marta).tuParte, 0);

    // 8. The group chat tells the same story, oldest first, and carries plain messages.
    const outsider = await person('Fuera');
    await call(`/grupos/${group.id}/chat`, outsider, 'GET', undefined, 403);
    await call(`/grupos/${group.id}/mensajes`, outsider, 'POST', { texto: 'hola' }, 404);
    await call(`/grupos/${group.id}/mensajes`, ana, 'POST', { texto: '   ' }, 400);
    const sent = await call(`/grupos/${group.id}/mensajes`, ana, 'POST', { texto: 'Listo, te yapeé 🙌' }, 201);
    assert.equal((await call(`/grupos/${group.id}/mensajes`, ana, 'POST', { texto: 'Listo, te yapeé 🙌' })).id, sent.id, 'a double tap never duplicates a message');
    const chat = await call(`/grupos/${group.id}/chat`, owner);
    assert.deepEqual([...new Set(chat.map((i) => i.tipo))], ['creado', 'cuenta', 'union', 'pago', 'mensaje']);
    assert.ok(chat.every((item, i) => i === 0 || new Date(chat[i - 1].fecha) <= new Date(item.fecha)));
    const bubble = chat.find((i) => i.tipo === 'cuenta');
    assert.deepEqual({ monto: bubble.monto, partes: bubble.partes, libres: bubble.libres, mio: bubble.mio }, { monto: 50000, partes: 5, libres: 0, mio: true });
    assert.deepEqual(chat.filter((i) => i.tipo === 'union').map((i) => i.parte), [10000, 10000, 10000, 10000, null]);
    assert.equal(chat.find((i) => i.tipo === 'pago').estado, 'exitoso');
    const message = chat.find((i) => i.tipo === 'mensaje');
    assert.deepEqual({ texto: message.texto, mio: message.mio, puedeEliminar: message.puedeEliminar }, { texto: 'Listo, te yapeé 🙌', mio: false, puedeEliminar: true });
    // A waiting payment is shown to the receiver with the action to decide it.
    const waiting = await call('/pagos/reportar', luis, 'POST', { grupoId: group.id, receptorId: owner.usuario.id, monto: 5000, metodo: 'plin' }, 201);
    assert.equal((await call(`/grupos/${group.id}/chat`, owner)).find((i) => i.pagoId === waiting.id).apruebaComo, 'receptor');
    assert.equal((await call(`/grupos/${group.id}/chat`, luis)).find((i) => i.pagoId === waiting.id).apruebaComo, null);
    // Unread badge: opening the chat reads it; what others do afterwards counts, your own actions never.
    await call(`/grupos/${group.id}/chat`, owner);
    const unread = async (user) => (await call('/grupos', user)).find((g) => g.id === group.id).noLeidos;
    assert.equal(await unread(owner), 0);
    await call(`/grupos/${group.id}/mensajes`, owner, 'POST', { texto: 'Gracias a todos' }, 201);
    assert.equal(await unread(owner), 0, 'own message is not unread');
    await call(`/grupos/${group.id}/mensajes`, marta, 'POST', { texto: 'Yo pago mañana' }, 201);
    assert.equal(await unread(owner), 1);
    await call(`/grupos/${group.id}/chat`, owner);
    assert.equal(await unread(owner), 0);
    // Messages never reach expense or payment comment threads, nor the expense count.
    assert.equal((await call(`/comentarios?gastoId=${bubble.gastoId}`, owner)).length, 0);

    // 9. Deadline: only an admin sets it, never in the past; reminders go once per stage, never at night.
    const deadline = '2026-12-20T20:00:00.000Z'; // 15:00 in Lima
    await call(`/grupos/${group.id}`, ana, 'PUT', { fechaLimite: deadline }, 403);
    await call(`/grupos/${group.id}`, owner, 'PUT', { fechaLimite: '2020-01-01T00:00:00Z' }, 400);
    await call(`/grupos/${group.id}`, owner, 'PUT', { fechaLimite: deadline });
    assert.equal((await call(`/grupos/${group.id}`, owner)).fechaLimite, deadline);
    const { ejecutarRecordatoriosPorFecha } = require('../apps/api/dist/services/recordatorios.service.js');
    // Other QA groups may share this database: count only this group's reminders.
    const runDeadlines = async (now) => {
      const before = await db.recordatorio.count({ where: { grupoId: group.id } });
      await ejecutarRecordatoriosPorFecha(now);
      return (await db.recordatorio.count({ where: { grupoId: group.id } })) - before;
    };
    assert.equal(await runDeadlines(new Date('2026-12-16T15:00:00Z')), 0, 'more than 3 days before: nothing');
    assert.equal(await runDeadlines(new Date('2026-12-20T04:00:00Z')), 0, '23:00 in Lima: quiet');
    // Luis (S/ 50 left after his reported S/ 50), Marta and Pedro still owe; Ana is settled.
    assert.equal(await runDeadlines(new Date('2026-12-20T15:00:00Z')), 3);
    assert.equal(await runDeadlines(new Date('2026-12-20T17:00:00Z')), 0, 'one reminder per stage');
    assert.equal((await db.recordatorio.findFirst({ where: { grupoId: group.id, enviadoA: luis.usuario.id, tipo: 'limite-d1' } })).monto, 5000);
    assert.equal(await db.recordatorio.count({ where: { grupoId: group.id, enviadoA: ana.usuario.id } }), 0);
    assert.equal(await runDeadlines(new Date('2026-12-21T15:00:00Z')), 3, 'the day it passes');
    const reminders = (await call(`/grupos/${group.id}/chat`, marta)).filter((i) => i.tipo === 'recordatorio');
    assert.deepEqual(reminders.map((r) => r.aviso), ['limite-d1', 'limite-d0']);
    await call(`/grupos/${group.id}`, owner, 'PUT', { fechaLimite: null });
    assert.equal(await runDeadlines(new Date('2026-12-22T15:00:00Z')), 0, 'removing the deadline stops reminders');

    console.log('PASS: bill in parts at creation, invitation shows the part, link/accept/rejoin take exactly one part, sixth person none, notices carry the part, Yape confirmed without growing the total, later bill and corrections. No external sends.');
  } finally { server.child.kill(); smtp.close(); await db.$disconnect(); }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1; });
