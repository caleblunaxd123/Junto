import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/firebase';
import { calcularSaldosGrupo } from './balance.service';
import { UserError as Error } from '../domain/errors';
import { transactionLock } from '../lib/transactionLock';
import { deadlineMessage, deadlineStage, isQuietHour, OVERDUE_REMINDER_DAYS } from '../domain/deadline';
import { renderDeadlineEmail } from '../domain/reminderEmail';
import { deliver, emailProvider } from '../lib/email';
import type { Prisma } from '@prisma/client';

// One manual reminder per creditor and debtor in this window; reminders are a nudge, not spam.
export const REMINDER_COOLDOWN_HOURS = 12;

/** What is still unpaid after the payments the debtor already reported to this creditor. */
async function unpaidAfterReported(grupoId: string, deudorId: string, acreedorId: string, monto: number, db: Prisma.TransactionClient = prisma) {
  const reported = await db.pago.aggregate({ where: { grupoId, pagadorId: deudorId, receptorId: acreedorId, estado: 'reportado' }, _sum: { monto: true } });
  return monto - (reported._sum.monto ?? 0);
}

/** Read the current debt through the same transaction that protects membership and payments. */
async function currentUnpaid(tx: Prisma.TransactionClient, grupoId: string, deudorId: string, acreedorId: string) {
  const members = await tx.grupoMiembro.count({ where: { grupoId, activo: true, grupo: { activo: true }, usuario: { activo: true }, usuarioId: { in: [deudorId, acreedorId] } } });
  if (members !== 2) return { debt: 0, pending: 0 };
  const debt = (await calcularSaldosGrupo(grupoId, tx)).find(s => s.deudorId === deudorId && s.acreedorId === acreedorId)?.monto ?? 0;
  return { debt, pending: debt > 0 ? await unpaidAfterReported(grupoId, deudorId, acreedorId, debt, tx) : 0 };
}

type Tono = 'suave' | 'directo' | 'urgente';

function buildMensaje(
  acreedorNombre: string,
  monto: number,
  grupoNombre: string,
  tono: Tono,
  numRecordatorios: number
): string {
  const montoStr = (monto / 100).toFixed(2);

  if (numRecordatorios === 0 || tono === 'suave') {
    return `${acreedorNombre} te recuerda: tienes S/${montoStr} pendiente en ${grupoNombre}`;
  }
  if (numRecordatorios === 1 || tono === 'directo') {
    return `${acreedorNombre} te recuerda que aún tienes S/${montoStr} pendiente en ${grupoNombre}`;
  }
  return `${acreedorNombre} te recuerda que faltan S/${montoStr} en ${grupoNombre}. Si ya pagaste, regístralo en JUNTO para que pueda confirmarlo.`;
}

export async function enviarRecordatorio(
  acreedorId: string,
  deudorId: string,
  grupoId: string,
  tono: Tono
) {
  const { recordatorio, deudor } = await prisma.$transaction(async (tx) => {
    // Same lock order as payments, expenses and joining; no provider call holds a DB lock.
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    await transactionLock(tx, `reminder:${grupoId}:${acreedorId}:${deudorId}`);
    const miembro = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: acreedorId, activo: true, grupo: { activo: true } } });
    if (!miembro) throw new Error('No perteneces a este grupo');
    if (await tx.usuario.count({ where: { id: deudorId, sinCuenta: true } }))
      throw new Error('Esta persona aún no tiene JUNTO: envíale su enlace personal por WhatsApp desde «Invitar».', 409);
    const { debt, pending } = await currentUnpaid(tx, grupoId, deudorId, acreedorId);
    if (debt <= 0) throw new Error('Esta persona ya no te debe nada en este grupo. Actualiza para ver las cuentas.', 409);
    if (pending <= 0) throw new Error('Esta persona ya registró un pago por lo que te debe. Revisa si lo recibiste.', 409);
    const reciente = await tx.recordatorio.findFirst({
      where: { enviadoPor: acreedorId, enviadoA: deudorId, grupoId, fechaEnvio: { gte: new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3_600_000) } },
      select: { id: true },
    });
    if (reciente) throw new Error(`Ya le recordaste hace poco. Podrás enviar otro recordatorio dentro de ${REMINDER_COOLDOWN_HOURS} horas.`, 429);
    const [acreedor, deudor, grupo, numRecordatorios] = await Promise.all([
      tx.usuario.findUniqueOrThrow({ where: { id: acreedorId }, select: { nombre: true } }),
      tx.usuario.findUniqueOrThrow({ where: { id: deudorId }, select: { expoPushToken: true } }),
      tx.grupo.findUniqueOrThrow({ where: { id: grupoId }, select: { nombre: true } }),
      tx.recordatorio.count({ where: { enviadoPor: acreedorId, enviadoA: deudorId, grupoId } }),
    ]);
    const mensaje = buildMensaje(acreedor.nombre, pending, grupo.nombre, tono, numRecordatorios);
    const recordatorio = await tx.recordatorio.create({
      data: {
        enviadoPor: acreedorId,
        enviadoA: deudorId,
        grupoId,
        monto: pending,
        tipo: 'manual',
        tono,
        mensaje,
      },
    });
    return { recordatorio, deudor };
  });

  // Send push notification (never holds the request).
  if (deudor.expoPushToken) {
    void sendPushNotification(
      deudor.expoPushToken,
      'Recordatorio de deuda',
      recordatorio.mensaje!,
      { grupoId, recordatorioId: recordatorio.id, type: 'recordatorio' }
    );
  }

  return recordatorio;
}

export async function configurarRecordatorioAutomatico(
  grupoId: string,
  usuarioId: string,
  frecuenciaDias: number,
  activo: boolean
) {
  // (An upsert keyed on an empty id failed for everyone: an empty string is not a uuid.)
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    await transactionLock(tx, `reminder-config:${grupoId}:${usuarioId}`);
    const miembro = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId, activo: true, grupo: { activo: true } } });
    if (!miembro) throw new Error('No perteneces a este grupo');
    const existing = await tx.configRecordatorio.findFirst({ where: { grupoId, configuradoPor: usuarioId } });
    return existing
      ? tx.configRecordatorio.update({ where: { id: existing.id }, data: { frecuenciaDias, activo } })
      : tx.configRecordatorio.create({ data: { grupoId, configuradoPor: usuarioId, frecuenciaDias, activo } });
  });
}

export async function getHistorialRecordatorios(deudorId: string, acreedorId: string, grupoId: string) {
  if (!(await prisma.grupoMiembro.count({ where: { grupoId, usuarioId: acreedorId, activo: true, grupo: { activo: true } } }))) throw new Error('No perteneces a este grupo', 403);
  return prisma.recordatorio.findMany({
    where: { enviadoPor: acreedorId, enviadoA: deudorId, grupoId },
    orderBy: { fechaEnvio: 'desc' },
  });
}

/**
 * Cron job: run daily at 9 AM Peru time.
 * Sends automatic reminders for active debts.
 */
export async function ejecutarRecordatoriosAutomaticos() {
  console.info('[Cron] Running automatic reminders...');

  // Only for people still in an active group, and only for money owed to whoever configured it:
  // a reminder says "<acreedor> te recuerda", so nobody else may turn it on in their name.
  const configs = await prisma.configRecordatorio.findMany({
    where: { activo: true, grupo: { activo: true }, configurador: { activo: true, grupoMiembros: { some: { activo: true } } } },
    include: { grupo: { include: { miembros: { where: { activo: true } } } } },
  });

  for (const config of configs) {
    if (!config.grupo.miembros.some((m) => m.usuarioId === config.configuradoPor)) continue;
    const saldos = await calcularSaldosGrupo(config.grupoId);
    const sinCuenta = new Set((await prisma.usuario.findMany({ where: { id: { in: config.grupo.miembros.map((m) => m.usuarioId) }, sinCuenta: true }, select: { id: true } })).map((u) => u.id));
    // People added by name have no app or e-mail: nothing to send them.
    const activos = new Set(config.grupo.miembros.map((m) => m.usuarioId).filter((id) => !sinCuenta.has(id)));

    for (const saldo of saldos) {
      if (saldo.monto <= 0 || saldo.acreedorId !== config.configuradoPor || !activos.has(saldo.deudorId)) continue;
      const created = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${config.grupoId}::uuid FOR UPDATE`;
        await transactionLock(tx, `reminder:${config.grupoId}:${saldo.acreedorId}:${saldo.deudorId}`);
        const currentConfig = await tx.configRecordatorio.findUnique({ where: { id: config.id } });
        if (!currentConfig?.activo) return null;
        const { pending } = await currentUnpaid(tx, config.grupoId, saldo.deudorId, saldo.acreedorId);
        if (pending <= 0) return null;
        const now = new Date();
        const recent = await tx.recordatorio.findFirst({
          where: {
            grupoId: config.grupoId, enviadoPor: saldo.acreedorId, enviadoA: saldo.deudorId,
            OR: [
              { tipo: 'automatico', fechaEnvio: { gte: new Date(now.getTime() - currentConfig.frecuenciaDias * 86_400_000) } },
              { fechaEnvio: { gte: new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 3_600_000) } },
            ],
          }, select: { id: true },
        });
        if (recent) return null;
        const [acreedor, deudor, grupo, numRecordatorios] = await Promise.all([
          tx.usuario.findUniqueOrThrow({ where: { id: saldo.acreedorId }, select: { nombre: true } }),
          tx.usuario.findUniqueOrThrow({ where: { id: saldo.deudorId }, select: { expoPushToken: true } }),
          tx.grupo.findUniqueOrThrow({ where: { id: config.grupoId }, select: { nombre: true } }),
          tx.recordatorio.count({ where: { grupoId: config.grupoId, enviadoPor: saldo.acreedorId, enviadoA: saldo.deudorId } }),
        ]);
        const tono: Tono = numRecordatorios === 0 ? 'suave' : numRecordatorios === 1 ? 'directo' : 'urgente';
        const mensaje = buildMensaje(acreedor.nombre, pending, grupo.nombre, tono, numRecordatorios);
        const recordatorio = await tx.recordatorio.create({
          data: {
            enviadoPor: saldo.acreedorId,
            enviadoA: saldo.deudorId,
            grupoId: config.grupoId,
            monto: pending,
            tipo: 'automatico',
            tono,
            mensaje,
          },
        });
        return { recordatorio, deudor };
      });

      if (created?.deudor.expoPushToken) {
        void sendPushNotification(created.deudor.expoPushToken, 'Recordatorio de deuda', created.recordatorio.mensaje!, {
          grupoId: config.grupoId,
          type: 'recordatorio_automatico',
        }).catch(() => console.error('[Notification] Automatic reminder saved; push delivery failed'));
      }
    }
  }

  console.info('[Cron] Automatic reminders done');
}


/**
 * Hourly: as a group's deadline approaches and after it passes, everyone who still owes gets one
 * reminder per stage (see deadlineStage). Never at night, never to someone whose reported payment
 * already covers it. Each reminder is recorded, so the group chat shows it.
 */
export async function ejecutarRecordatoriosPorFecha(now = new Date()) {
  if (isQuietHour(now)) return 0;
  const grupos = await prisma.grupo.findMany({
    where: { activo: true, fechaLimite: { gte: new Date(now.getTime() - (OVERDUE_REMINDER_DAYS + 1) * 86_400_000), lte: new Date(now.getTime() + 3 * 86_400_000) } },
    select: { id: true, nombre: true, modo: true, fechaLimite: true, miembros: { where: { activo: true }, select: { usuarioId: true, usuario: { select: { sinCuenta: true } } } } },
  });
  let sent = 0;
  for (const grupo of grupos) {
    const stage = deadlineStage(now, grupo.fechaLimite!);
    if (!stage) continue;
    const activos = new Set(grupo.miembros.map((m) => m.usuarioId));
    // People added by name have no app or e-mail: their reminder is the WhatsApp link, sent by hand.
    const conCuenta = new Set(grupo.miembros.filter((m) => !m.usuario.sinCuenta).map((m) => m.usuarioId));
    for (const saldo of await calcularSaldosGrupo(grupo.id)) {
      if (saldo.monto <= 0 || !conCuenta.has(saldo.deudorId) || !activos.has(saldo.acreedorId)) continue;
      const created = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupo.id}::uuid FOR UPDATE`;
        await transactionLock(tx, `reminder:${grupo.id}:${saldo.acreedorId}:${saldo.deudorId}`);
        const currentGroup = await tx.grupo.findUnique({ where: { id: grupo.id }, select: { activo: true, fechaLimite: true, nombre: true, modo: true } });
        // A moved/cancelled deadline will be considered on the next hourly run, not from this stale candidate.
        if (!currentGroup?.activo || !currentGroup.fechaLimite || currentGroup.fechaLimite.getTime() !== grupo.fechaLimite!.getTime()) return null;
        const currentStage = deadlineStage(now, currentGroup.fechaLimite);
        if (!currentStage) return null;
        const { pending } = await currentUnpaid(tx, grupo.id, saldo.deudorId, saldo.acreedorId);
        if (pending <= 0) return null;
        const already = await tx.recordatorio.findFirst({
          where: {
            grupoId: grupo.id, enviadoA: saldo.deudorId, enviadoPor: saldo.acreedorId,
            OR: [
              { tipo: currentStage, limiteReferencia: currentGroup.fechaLimite },
              { fechaEnvio: { gte: new Date(now.getTime() - REMINDER_COOLDOWN_HOURS * 3_600_000) } },
            ],
          },
          select: { id: true },
        });
        if (already) return null;
        const mensaje = deadlineMessage(currentStage, pending, currentGroup.nombre, currentGroup.fechaLimite, currentGroup.modo === 'division');
        const recordatorio = await tx.recordatorio.create({
          data: { enviadoPor: saldo.acreedorId, enviadoA: saldo.deudorId, grupoId: grupo.id, monto: pending, tipo: currentStage, limiteReferencia: currentGroup.fechaLimite, fechaEnvio: now, tono: currentStage.startsWith('limite-v') ? 'directo' : 'suave', mensaje },
        });
        const deudor = await tx.usuario.findUniqueOrThrow({ where: { id: saldo.deudorId }, select: { expoPushToken: true, email: true, nombre: true } });
        return { recordatorio, deudor, grupo: currentGroup.nombre };
      });
      if (!created) continue;
      sent += 1;
      const { deudor, recordatorio } = created;
      const late = recordatorio.tipo.startsWith('limite-v') || recordatorio.tipo === 'limite-d0';
      if (deudor?.expoPushToken) {
        void sendPushNotification(deudor.expoPushToken, late ? 'Tu pago está vencido' : 'Se acerca la fecha límite', recordatorio.mensaje!, { grupoId: grupo.id, type: 'recordatorio_fecha' })
          .catch(() => console.error('[Notification] Deadline reminder saved; push delivery failed'));
      }
      // E-mail too: web users get no push. Once per stage, like the push, and never blocking the job.
      if (deudor.email && emailProvider()) {
        void deliver({ to: deudor.email, ...renderDeadlineEmail({ nombre: deudor.nombre, grupo: created.grupo, mensaje: recordatorio.mensaje!, late, grupoId: grupo.id, publicUrl: process.env.PUBLIC_WEB_URL }) })
          .catch(() => console.error('[Notification] Deadline reminder saved; e-mail delivery failed'));
      }
    }
  }
  return sent;
}
