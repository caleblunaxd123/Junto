// Local fictional accounts only, loopback SMTP, never contacts friends or production.
const assert = require('node:assert/strict');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const helpers = require('./test-share-email-api.cjs');
const db = new PrismaClient();
const suffix = Date.now();
async function run() {
  const smtp = await helpers.startSmtp();
  const server = helpers.startApi(3031, { SMTP_HOST: '127.0.0.1', SMTP_PORT: String(smtp.port), SMTP_USER: 'qa@example.invalid', SMTP_PASS: 'fictional-only', SMTP_ALLOW_INSECURE_LOCAL: 'true', EMAIL_FROM: 'JUNTO <qa@example.invalid>' });
  try {
    await server.ready;
    async function call(route, user, method = 'GET', body, status = 200) {
      const response = await fetch('http://127.0.0.1:3031/api' + route, { method, headers: { 'Content-Type': 'application/json', ...(user ? { Authorization: `Bearer ${user.accessToken}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
      const data = await response.json();
      assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    async function person(name) {
      const email = `qa-join-${name.toLowerCase()}-${suffix}@example.invalid`;
      await call('/auth/register', null, 'POST', { nombre: name + ' QA', email, password: `JoinQA${suffix}!` }, 201);
      const user = await db.usuario.findUniqueOrThrow({ where: { email } });
      return { email, ...await call('/auth/verify-email', null, 'POST', { email, otp: user.otpCode }) };
    }
    const people = await Promise.all(['Caleb', 'Ana', 'Luis', 'Marta', 'Pedro', 'New', 'No'].map(person));
    const [owner, ana, luis, marta, pedro, newcomer, declines] = people;
    const group = await call('/grupos', owner, 'POST', { nombre: `QA 500 y avisos ${suffix}`, tipo: 'amigos' }, 201);
    assert.equal((await call('/notificaciones', owner)).length, 0);
    await call(`/grupos/${group.id}/invitar`, owner, 'POST', { identificador: ana.email });
    const [invite] = await call('/invitaciones', ana);
    // Joining by link and accepting simultaneously produce exactly one notice and one membership.
    const linkJoin = call('/grupos/unirse', ana, 'POST', { link: group.linkInvitacion });
    const accept = fetch(`http://127.0.0.1:3031/api/invitaciones/${invite.id}/aceptar`, { method: 'POST', headers: { Authorization: `Bearer ${ana.accessToken}` } });
    const [, decision] = await Promise.all([linkJoin, accept]);
    assert.ok([200, 409].includes(decision.status));
    await call('/grupos/unirse', ana, 'POST', { link: group.linkInvitacion });
    assert.equal(await db.avisoGrupo.count({ where: { grupoId: group.id, integranteId: ana.usuario.id, usuarioId: owner.usuario.id } }), 1);
    for (const p of [luis, marta, pedro]) await call('/grupos/unirse', p, 'POST', { link: group.linkInvitacion });
    const notices = await call('/notificaciones', owner);
    assert.equal(notices.length, 4);
    await call(`/notificaciones/${notices[0].id}/leida`, ana, 'POST', undefined, 404);
    await call(`/notificaciones/${notices[0].id}/leida`, owner, 'POST');
    await call(`/notificaciones/${notices[0].id}/leida`, owner, 'POST');
    assert.equal((await call('/notificaciones', owner)).filter(n => n.leido).length, 1);
    await call(`/grupos/${group.id}/invitar`, owner, 'POST', { identificador: declines.email });
    const [no] = await call('/invitaciones', declines);
    await call(`/invitaciones/${no.id}/rechazar`, declines, 'POST');
    assert.equal((await call('/notificaciones', owner)).length, 4);
    const bill = await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Cuenta 500', montoTotal: 50000, pagadoPor: owner.usuario.id, participantes: people.slice(0, 5).map(p => ({ usuarioId: p.usuario.id })) }, 201);
    let detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.resumen.totalGastado, 50000);
    assert.equal(detail.balanceUsuario.teDeben, 40000);
    const payment = await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: owner.usuario.id, monto: 5000, metodo: 'yape' }, 201);
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.resumen.cuentas.find(a => a.usuarioId === ana.usuario.id).pagosPorConfirmar, 5000);
    assert.equal(detail.balanceUsuario.teDeben, 40000);
    await call(`/pagos/${payment.id}/confirmar`, ana, 'POST', undefined, 400);
    await call(`/pagos/${payment.id}/confirmar`, owner, 'POST');
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.resumen.totalGastado, 50000);
    assert.equal(detail.balanceUsuario.teDeben, 35000);
    assert.equal(detail.resumen.cuentas.find(a => a.usuarioId === ana.usuario.id).neto, -5000);
    await call('/pagos/reportar', ana, 'POST', { grupoId: group.id, receptorId: owner.usuario.id, monto: 5001, metodo: 'plin' }, 400);
    await call('/grupos/unirse', newcomer, 'POST', { link: group.linkInvitacion });
    detail = await call(`/grupos/${group.id}`, owner);
    assert.equal(detail.resumen.cuentas.find(a => a.usuarioId === newcomer.usuario.id).tuParte, 0);
    assert.equal(detail.resumen.cuentas.find(a => a.usuarioId === ana.usuario.id).tuParte, 10000);
    assert.equal((await call('/notificaciones', owner)).length, 5);
    // This exact fictional fixture is used by optional browser QA, never logged with tokens.
    if (process.env.JUNTO_QA_GROUP_FIXTURE === 'true') {
      const fs = require('node:fs'); const path = require('node:path');
      fs.writeFileSync(path.join(__dirname, 'artifacts/group-contribution-private.json'), JSON.stringify({ owner, ana, groupId: group.id, billId: bill.id }));
    }
    console.log('PASS: durable join notices, concurrent link/accept deduplication, recipient-only read, rejection silent, 500 split into five, partial Yape confirmed, self-approval/overpayment blocked, late join preserves split. No external sends.');
  } finally { server.child.kill(); smtp.close(); await db.$disconnect(); }
}
run().catch(error => { console.error(error.message); process.exitCode = 1; });
