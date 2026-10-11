// Real PostgreSQL, fictional local fixtures, no tokens, mail provider or external requests.
require('./local-qa.cjs').localQa();
process.env.SMTP_HOST = ''; process.env.SMTP_USER = ''; process.env.SMTP_PASS = ''; process.env.RESEND_API_KEY = '';
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const prismaModule = require('../apps/api/dist/lib/prisma.js');
const db = prismaModule.prisma;
const { resolverPago, reportarPago } = require('../apps/api/dist/services/pagos.service.js');
const { crearGasto, editarGasto, eliminarGasto } = require('../apps/api/dist/services/gastos.service.js');
const { enviarRecordatorio, ejecutarRecordatoriosPorFecha, ejecutarRecordatoriosAutomaticos, configurarRecordatorioAutomatico, getHistorialRecordatorios } = require('../apps/api/dist/services/recordatorios.service.js');
const { resumenCuentasGrupo } = require('../apps/api/dist/services/balance.service.js');
const { deleteAccount } = require('../apps/api/dist/services/account.service.js');
const { crearGrupo, editarGrupo, unirseConLink } = require('../apps/api/dist/services/grupos.service.js');
const suffix = Date.now();
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

async function fixture(label, waiting = 0) {
  const people = await Promise.all(['owner', 'payer', 'admin'].map(name => db.usuario.create({ data: {
    nombre: `${name} QA ${label}`, email: `qa-race-${label}-${name}-${suffix}@example.invalid`,
    passwordHash: '!fictional-fixture-login-disabled', emailVerificado: true,
  } })));
  const [owner, payer, admin] = people;
  const group = await db.grupo.create({ data: { nombre: `QA concurrency ${label}`, creadoPor: owner.id, aprobacionPagos: 'administrador', miembros: { create: people.map(p => ({ usuarioId: p.id, rol: p === payer ? 'miembro' : 'admin' })) } } });
  const expense = await db.gasto.create({ data: { grupoId: group.id, creadoPor: owner.id, pagadoPor: owner.id, descripcion: 'QA deuda 100', montoTotal: 10000, participantes: { create: [{ usuarioId: payer.id, montoAsignado: 10000 }] } } });
  const payment = waiting ? await db.pago.create({ data: { grupoId: group.id, pagadorId: payer.id, receptorId: owner.id, monto: waiting, metodo: 'efectivo', estado: 'reportado' } }) : null;
  return { group, owner, payer, admin, expense, payment };
}

/** Hold the same group lock used by a competing device, start the operation, then commit its change. */
async function whileGroupLocked(groupId, operation, change) {
  let entered, release;
  const ready = new Promise(resolve => { entered = resolve; });
  const held = new Promise(resolve => { release = resolve; });
  const locking = db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${groupId}::uuid FOR UPDATE`;
    entered(); await held;
    if (change) await change(tx);
  }, { timeout: 10000 });
  await ready;
  let settled = false;
  const result = operation().then(value => ({ ok: true, value }), error => ({ ok: false, error })).finally(() => { settled = true; });
  try {
    await pause(150);
    assert.equal(settled, false, 'mutation ignored the group lock and could use stale balances/permissions');
  } finally { release(); await locking; }
  return result;
}

async function run() {
  const approval = await fixture('approval', 5000);
  const decision = await whileGroupLocked(approval.group.id,
    () => resolverPago(approval.payment.id, approval.admin.id, true),
    tx => tx.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: approval.group.id, usuarioId: approval.admin.id } }, data: { rol: 'miembro' } }));
  assert.equal(decision.ok, false, 'a removed admin permission must be rechecked at commit');
  assert.equal((await db.pago.findUniqueOrThrow({ where: { id: approval.payment.id } })).estado, 'reportado');
  const receiver = await resolverPago(approval.payment.id, approval.owner.id, true);
  assert.equal(receiver.estado, 'exitoso');

  const metadata = await fixture('metadata');
  const renamed = await whileGroupLocked(metadata.group.id, () => editarGrupo(metadata.group.id, { nombre: 'QA unauthorized rename' }, metadata.admin.id),
    tx => tx.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: metadata.group.id, usuarioId: metadata.admin.id } }, data: { rol: 'miembro' } }));
  assert.equal(renamed.ok, false, 'editing group metadata must recheck the admin role after waiting');
  assert.equal((await db.grupo.findUniqueOrThrow({ where: { id: metadata.group.id } })).nombre, metadata.group.nombre);

  const add = await fixture('add');
  const created = await whileGroupLocked(add.group.id, () => crearGasto(add.group.id, {
    solicitudId: randomUUID(), descripcion: 'QA gasto tardío', montoTotal: 1000, pagadoPor: add.owner.id,
    categoria: 'otro', tipoDivision: 'igual', participantes: [{ usuarioId: add.payer.id }],
  }, add.owner.id), tx => tx.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: add.group.id, usuarioId: add.payer.id } }, data: { activo: false } }));
  assert.equal(created.ok, false, 'a member removed while saving cannot receive new debt');
  assert.equal(await db.gasto.count({ where: { grupoId: add.group.id } }), 1);

  const edit = await fixture('edit');
  const edited = await whileGroupLocked(edit.group.id, () => editarGasto(edit.expense.id, { montoTotal: 20000, tipoDivision: 'igual', participantes: [{ usuarioId: edit.payer.id }] }, edit.owner.id),
    tx => tx.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: edit.group.id, usuarioId: edit.payer.id } }, data: { activo: false } }));
  assert.equal(edited.ok, false, 'editing must recheck former members under the lock');
  assert.equal((await db.gasto.findUniqueOrThrow({ where: { id: edit.expense.id } })).montoTotal, 10000);

  const remove = await fixture('delete');
  const removed = await whileGroupLocked(remove.group.id, () => eliminarGasto(remove.expense.id, remove.owner.id),
    tx => tx.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: remove.group.id, usuarioId: remove.payer.id } }, data: { activo: false } }));
  assert.equal(removed.ok, false);
  assert.equal((await db.gasto.findUniqueOrThrow({ where: { id: remove.expense.id } })).activo, true);

  const remind = await fixture('manual');
  const reminded = await whileGroupLocked(remind.group.id, () => enviarRecordatorio(remind.owner.id, remind.payer.id, remind.group.id, 'suave'),
    tx => tx.gasto.update({ where: { id: remind.expense.id }, data: { activo: false } }));
  assert.equal(reminded.ok, false, 'do not remind a debt settled/removed by another device');
  assert.equal(await db.recordatorio.count({ where: { grupoId: remind.group.id } }), 0);

  const dated = await fixture('deadline');
  const now = new Date('2027-01-15T15:00:00Z');
  const deadline = new Date('2027-01-16T15:00:00Z');
  await db.grupo.update({ where: { id: dated.group.id }, data: { fechaLimite: deadline } });
  await whileGroupLocked(dated.group.id, () => ejecutarRecordatoriosPorFecha(now),
    tx => tx.gasto.update({ where: { id: dated.expense.id }, data: { activo: false } }));
  assert.equal(await db.recordatorio.count({ where: { grupoId: dated.group.id } }), 0);

  const moved = await fixture('moved-deadline');
  await db.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: deadline } });
  await whileGroupLocked(moved.group.id, () => ejecutarRecordatoriosPorFecha(now),
    tx => tx.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: new Date('2027-01-20T15:00:00Z') } }));
  assert.equal(await db.recordatorio.count({ where: { grupoId: moved.group.id } }), 0, 'do not notify the date that was just moved');
  await db.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: deadline } });
  await Promise.all([ejecutarRecordatoriosPorFecha(now), ejecutarRecordatoriosPorFecha(now)]);
  const first = await db.recordatorio.findMany({ where: { grupoId: moved.group.id } });
  assert.equal(first.length, 1, 'two cron workers must save exactly one reminder');
  assert.equal(first[0].limiteReferencia.toISOString(), deadline.toISOString());
  assert.equal(first[0].monto, 10000);
  const tomorrow = new Date('2027-01-16T15:00:00Z');
  const movedDeadline = new Date('2027-01-17T15:00:00Z');
  await db.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: movedDeadline } });
  await ejecutarRecordatoriosPorFecha(tomorrow);
  assert.equal(await db.recordatorio.count({ where: { grupoId: moved.group.id, tipo: first[0].tipo } }), 2, 'same stage for a new deadline must not be suppressed by the old window');
  await db.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: new Date('2027-01-17T16:00:00Z') } });
  await ejecutarRecordatoriosPorFecha(new Date('2027-01-16T16:00:00Z'));
  assert.equal(await db.recordatorio.count({ where: { grupoId: moved.group.id } }), 2, 'moving the date repeatedly cannot spam the same person');
  await db.grupo.update({ where: { id: moved.group.id }, data: { fechaLimite: null } });

  const automatic = await fixture('automatic-off');
  const config = await configurarRecordatorioAutomatico(automatic.group.id, automatic.owner.id, 1, true);
  await whileGroupLocked(automatic.group.id, () => ejecutarRecordatoriosAutomaticos(),
    tx => tx.configRecordatorio.update({ where: { id: config.id }, data: { activo: false } }));
  assert.equal(await db.recordatorio.count({ where: { grupoId: automatic.group.id } }), 0, 'a disabled configuration cannot send from a stale cron candidate');
  await configurarRecordatorioAutomatico(automatic.group.id, automatic.owner.id, 1, true);
  await Promise.all([ejecutarRecordatoriosAutomaticos(), ejecutarRecordatoriosAutomaticos()]);
  assert.equal(await db.recordatorio.count({ where: { grupoId: automatic.group.id } }), 1);
  await assert.rejects(enviarRecordatorio(automatic.owner.id, automatic.payer.id, automatic.group.id, 'suave'), error => error.statusCode === 429 || error.status === 429);
  await db.grupoMiembro.update({ where: { grupoId_usuarioId: { grupoId: automatic.group.id, usuarioId: automatic.owner.id } }, data: { activo: false } });
  await assert.rejects(getHistorialRecordatorios(automatic.payer.id, automatic.owner.id, automatic.group.id));

  const deleting = await fixture('delete-account');
  const destination = await crearGrupo({ nombre: 'QA destination' }, deleting.payer.id);
  const result = await whileGroupLocked(deleting.group.id, async () => {
    const removal = deleteAccount(deleting.owner.id, { confirmacion: 'ELIMINAR' });
    // Deletion takes the membership gate before waiting for the group lock.
    await pause(50);
    const join = unirseConLink(destination.linkInvitacion, deleting.owner.id).then(value => ({ ok: true, value }), error => ({ ok: false, error }));
    await removal;
    return join;
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.ok, false, 'an account being deleted cannot concurrently acquire a new group');
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: deleting.owner.id } })).activo, false);
  assert.equal(await db.grupoMiembro.count({ where: { usuarioId: deleting.owner.id, activo: true } }), 0);
  assert.equal((await db.gasto.findUniqueOrThrow({ where: { id: deleting.expense.id } })).montoTotal, 10000, 'deletion preserves the other members\' ledger');
  await assert.rejects(crearGrupo({ nombre: 'QA deleted creator' }, deleting.owner.id));

  const reset = await fixture('reset-before-delete');
  const oldConfirmation = await whileGroupLocked(reset.group.id, () => deleteAccount(reset.owner.id, { confirmacion: 'ELIMINAR' }),
    tx => tx.usuario.update({ where: { id: reset.owner.id }, data: { passwordHash: '!fictional-credentials-rotated' } }));
  assert.equal(oldConfirmation.ok, false, 'a stale authenticated confirmation cannot delete after credentials change');
  assert.equal((await db.usuario.findUniqueOrThrow({ where: { id: reset.owner.id } })).activo, true);

  // A confirmation racing with another report cannot reopen the original unpaid allowance.
  const limit = await fixture('limit', 10000);
  const original = prismaModule.prisma;
  let confirming, intercepted = false;
  prismaModule.prisma = original.$extends({ query: { pago: { async findMany({ args, query }) {
    if (!intercepted && args.where?.grupoId === limit.group.id && args.where?.estado === 'reportado') {
      intercepted = true;
      confirming = resolverPago(limit.payment.id, limit.owner.id, true).then(value => ({ ok: true, value }), error => ({ ok: false, error }));
      await pause(100);
    }
    return query(args);
  } } } });
  try {
    await assert.rejects(reportarPago({ grupoId: limit.group.id, receptorId: limit.owner.id, monto: 10000, metodo: 'efectivo' }, limit.payer.id));
    assert.equal((await confirming).ok, true);
    assert.equal(await db.pago.count({ where: { grupoId: limit.group.id } }), 1);
    assert.equal((await resumenCuentasGrupo(limit.group.id)).saldos.length, 0);
  } finally { prismaModule.prisma = original; }
  console.log('PASS: real group locks; approval permissions, create/edit/delete membership, stale debts, moved deadlines, disabled cron config, multi-worker dedup/cooldown, former-member access, account deletion/join/reset and report/confirm allowance race. Local fictional fixtures only.');
}
run().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => db.$disconnect());
