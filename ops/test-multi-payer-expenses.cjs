// Fictional accounts in a disposable local QA database only. No e-mail, push or external AI.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
require('./local-qa.cjs').localQa();
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');
const { credentialsTag } = require('../apps/api/dist/domain/credentials');
const { startApi } = require('./test-share-email-api.cjs');
const db = new PrismaClient();

async function run() {
  const server = startApi(3049, {});
  try {
    await server.ready;
    async function person(nombre) {
      const user = await db.usuario.create({ data: { nombre, email: `${randomUUID()}@example.invalid`, passwordHash: '!', emailVerificado: true } });
      return { id: user.id, token: jwt.sign({ userId: user.id, email: user.email, credentialsTag: credentialsTag(user.passwordHash, process.env.JWT_SECRET) }, process.env.JWT_SECRET, { expiresIn: '15m' }) };
    }
    async function call(route, who, method = 'GET', body, status = 200) {
      const response = await fetch(`http://127.0.0.1:3049/api${route}`, { method, headers: { Authorization: `Bearer ${who.token}`, 'Content-Type': 'application/json', 'X-Junto-Currency-Version': '1' }, body: body ? JSON.stringify(body) : undefined });
      const data = response.status === 204 ? null : await response.json();
      assert.equal(response.status, status, `${method} ${route}: ${JSON.stringify(data)}`);
      return data;
    }
    const people = await Promise.all(['Organizador', 'Ana', 'Luis', 'Marta', 'Pedro', 'Fuera'].map(name => person(`${name} QA`)));
    const [owner, ana, luis, marta, pedro, outsider] = people;
    const group = await call('/grupos', owner, 'POST', { nombre: 'Tres adelantaron QA' }, 201);
    for (const user of people.slice(1, 5)) await call('/grupos/unirse', user, 'POST', { link: group.linkInvitacion });
    const detail = () => call(`/grupos/${group.id}`, owner);
    assert.equal((await detail()).funciones.variosPagadores, true);
    const body = { descripcion: 'Cena entre cinco QA', montoTotal: 50000, pagadoPor: owner.id, pagadores: [{ usuarioId: owner.id, monto: 20000 }, { usuarioId: ana.id, monto: 20000 }, { usuarioId: luis.id, monto: 10000 }], participantes: people.slice(0, 5).map(user => ({ usuarioId: user.id })), solicitudId: `multi-${randomUUID()}` };
    for (const pagadores of [[], [{ usuarioId: owner.id, monto: 49999 }], [{ usuarioId: owner.id, monto: 50001 }], [{ usuarioId: owner.id, monto: 25000 }, { usuarioId: owner.id, monto: 25000 }], [{ usuarioId: owner.id, monto: 40000 }, { usuarioId: outsider.id, monto: 10000 }]])
      await call(`/grupos/${group.id}/gastos`, owner, 'POST', { ...body, solicitudId: undefined, pagadores }, 400);
    const expense = await call(`/grupos/${group.id}/gastos`, owner, 'POST', body, 201);
    assert.equal(expense.pagadores.length, 3);
    const retry = await call(`/grupos/${group.id}/gastos`, owner, 'POST', { ...body, pagadores: [...body.pagadores].reverse() });
    assert.equal(retry.id, expense.id);
    await call(`/grupos/${group.id}/gastos`, owner, 'POST', { ...body, pagadores: [{ usuarioId: owner.id, monto: 30000 }, { usuarioId: ana.id, monto: 10000 }, { usuarioId: luis.id, monto: 10000 }] }, 409);
    let g = await detail();
    assert.equal(g.resumen.totalGastado, 50000);
    for (const [i, user] of people.slice(0, 5).entries()) {
      const row = g.resumen.cuentas.find(p => p.usuarioId === user.id);
      assert.equal(row.pagaste, [20000, 20000, 10000, 0, 0][i]);
      assert.equal(row.neto, [10000, 10000, 0, -10000, -10000][i]);
      const statement = await call(`/grupos/${group.id}/estado-cuenta`, user);
      assert.equal(statement.totales.saldo, row.neto);
      assert.equal(statement.totales.pagasteEnGastos, row.pagaste);
    }
    assert.equal((await call(`/grupos/${group.id}/chat`, owner)).find(item => item.gastoId === expense.id).pagadores.length, 3);
    // Old single-payer clients cannot silently overwrite the advances of three people.
    await call(`/gastos/${expense.id}`, owner, 'PUT', { montoTotal: 50000, pagadoPor: owner.id, tipoDivision: 'igual', participantes: body.participantes }, 409);
    await call(`/gastos/${expense.id}`, outsider, 'PUT', { descripcion: 'Intruso' }, 400);
    await call(`/gastos/${expense.id}`, owner, 'PUT', { descripcion: 'Cena corregida QA' });
    assert.equal((await call(`/gastos/${expense.id}`, owner)).pagadores.length, 3);
    const edit = { ...body, solicitudId: undefined, tipoDivision: 'exacto', participantes: people.slice(0, 5).map((user, i) => ({ usuarioId: user.id, monto: [0, 20000, 10000, 0, 20000][i] })) };
    await call(`/gastos/${expense.id}`, owner, 'PUT', edit);
    g = await detail();
    assert.equal(g.resumen.cuentas.find(row => row.usuarioId === pedro.id).neto, -20000);
    assert.equal(g.resumen.cuentas.find(row => row.usuarioId === marta.id).neto, 0);
    const payment = await call('/pagos/reportar', pedro, 'POST', { grupoId: group.id, receptorId: owner.id, monto: 5000, metodo: 'yape' }, 201);
    assert.equal((await detail()).resumen.cuentas.find(row => row.usuarioId === pedro.id).neto, -20000);
    await call(`/pagos/${payment.id}/confirmar`, owner, 'POST', {});
    assert.equal((await detail()).resumen.cuentas.find(row => row.usuarioId === pedro.id).neto, -15000);
    await call(`/gastos/${expense.id}`, owner, 'PUT', { ...edit, descripcion: 'Otra corrección' });
    assert.equal((await db.pago.findUniqueOrThrow({ where: { id: payment.id } })).estado, 'exitoso');
    // A name-only co-payer has protected credit and inherits every advance, not just pagadoPor.
    const named = (await call(`/grupos/${group.id}/integrantes`, owner, 'POST', { nombres: ['Sofía sin app QA'] }, 201))[0];
    const withName = await detail();
    const slot = withName.miembros.find(m => m.usuarioId === named.id);
    const extra = await call(`/grupos/${group.id}/gastos`, owner, 'POST', { descripcion: 'Dos adelantaron QA', montoTotal: 1001, pagadoPor: owner.id, pagadores: [{ usuarioId: owner.id, monto: 501 }, { usuarioId: named.id, monto: 500 }], participantes: [{ usuarioId: pedro.id }] }, 201);
    assert.ok(!(await call(`/grupos/invitacion/${group.linkInvitacion}`, outsider)).sinApp.some(p => p.id === named.id));
    await call(`/grupos/${group.id}/integrantes/${named.id}`, owner, 'DELETE', undefined, 409);
    const before = (await detail()).resumen.totalGastado;
    await call('/grupos/unirse', outsider, 'POST', { link: slot.codigoPersonal });
    const inherited = await call(`/gastos/${extra.id}`, outsider);
    assert.equal(inherited.pagadores.find(p => p.usuarioId === outsider.id).monto, 500);
    assert.equal((await detail()).resumen.totalGastado, before);
    await call(`/grupos/${group.id}/archivo`, owner, 'PUT', { archivar: true });
    assert.equal((await detail()).archivado, true);
    assert.equal((await detail()).resumen.totalGastado, before);
    await call(`/grupos/${group.id}/archivo`, owner, 'PUT', { archivar: false });
    console.log('PASS: multi-payer creation/retry, exact cents, invalid advances/membership, statements/chat, safe editing, confirmed payments preserved, name inheritance and archive. No external sends.');
  } finally { server.child.kill(); await db.$disconnect(); }
}
run().catch(error => { console.error(error.stack); process.exitCode = 1; });
