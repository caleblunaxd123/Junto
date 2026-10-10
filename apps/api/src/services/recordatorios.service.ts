import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/firebase';
import { calcularSaldosGrupo } from './balance.service';
import { UserError as Error } from '../domain/errors';
import { transactionLock } from '../lib/transactionLock';
import { deadlineMessage, deadlineStage, isQuietHour, OVERDUE_REMINDER_DAYS } from '../domain/deadline';
import { renderDeadlineEmail } from '../domain/reminderEmail';
import { deliver, emailProvider } from '../lib/email';

// One manual reminder per creditor and debtor in this window; reminders are a nudge, not spam.
export const REMINDER_COOLDOWN_HOURS = 12;

/** What is still unpaid after the payments the debtor already reported to this creditor. */
async function unpaidAfterReported(grupoId: string, deudorId: string, acreedorId: string, monto: number) {
  const reported = await prisma.pago.aggregate({ where: { grupoId, pagadorId: deudorId, receptorId: acreedorId, estado: 'reportado' }, _sum: { monto: true } });
  return monto - (reported._sum.monto ?? 0);
}

type Tono = 'suave' | 'directo' | 'urgente';

function buildMensaje(
  acreedorNombre: string,
  deudorNombre: string,
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
  return `Llevas ya varios recordatorios con S/${montoStr} pendiente en ${grupoNombre}. Todos en el grupo pueden ver los saldos.`;
}

export async function enviarRecordatorio(
  acreedorId: string,
  deudorId: string,
  grupoId: string,
  tono: Tono
) {
  // Verify acreedor is member
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: acreedorId, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  // Calculate actual debt amount
  const saldos = await calcularSaldosGrupo(grupoId);
  const deuda = saldos.find((s) => s.deudorId === deudorId && s.acreedorId === acreedorId);
  if (!deuda || deuda.monto <= 0) throw new Error('Esta persona ya no te debe nada en este grupo. Actualiza para ver las cuentas.', 409);
  // A payment already reported (waiting for your answer) is not a reason to nag: answer it instead.
  const pendiente = await unpaidAfterReported(grupoId, deudorId, acreedorId, deuda.monto);
  if (pendiente <= 0) throw new Error('Esta persona ya registró un pago por lo que te debe. Revisa si lo recibiste.', 409);

  // Count previous reminders for escalation
  const numRecordatorios = await prisma.recordatorio.count({
    where: { enviadoPor: acreedorId, enviadoA: deudorId, grupoId },
  });

  const [acreedor, deudor, grupo] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: acreedorId }, select: { nombre: true } }),
    prisma.usuario.findUnique({
      where: { id: deudorId },
      select: { nombre: true, expoPushToken: true },
    }),
    prisma.grupo.findUnique({ where: { id: grupoId }, select: { nombre: true } }),
  ]);

  if (!acreedor || !deudor || !grupo) throw new Error('Datos no encontrados', 404);

  const mensaje = buildMensaje(
    acreedor.nombre,
    deudor.nombre,
    pendiente,
    grupo.nombre,
    tono,
    numRecordatorios
  );

  // Check-and-record under a lock so two taps (or two devices) cannot both send.
  const recordatorio = await prisma.$transaction(async (tx) => {
    await transactionLock(tx, `reminder:${grupoId}:${acreedorId}:${deudorId}`);
    const reciente = await tx.recordatorio.findFirst({
      where: { enviadoPor: acreedorId, enviadoA: deudorId, grupoId, fechaEnvio: { gte: new Date(Date.now() - REMINDER_COOLDOWN_HOURS * 3_600_000) } },
      select: { id: true },
    });
    if (reciente) throw new Error(`Ya le recordaste hace poco. Podrás enviar otro recordatorio dentro de ${REMINDER_COOLDOWN_HOURS} horas.`, 429);
    return tx.recordatorio.create({
      data: {
        enviadoPor: acreedorId,
        enviadoA: deudorId,
        grupoId,
        monto: pendiente,
        tipo: 'manual',
        tono,
        mensaje,
      },
    });
  });

  // Send push notification (never holds the request).
  if (deudor.expoPushToken) {
    void sendPushNotification(
      deudor.expoPushToken,
      'Recordatorio de deuda',
      mensaje,
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
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  // (An upsert keyed on an empty id failed for everyone: an empty string is not a uuid.)
  return prisma.$transaction(async (tx) => {
    await transactionLock(tx, `reminder-config:${grupoId}:${usuarioId}`);
    const existing = await tx.configRecordatorio.findFirst({ where: { grupoId, configuradoPor: usuarioId } });
    return existing
      ? tx.configRecordatorio.update({ where: { id: existing.id }, data: { frecuenciaDias, activo } })
      : tx.configRecordatorio.create({ data: { grupoId, configuradoPor: usuarioId, frecuenciaDias, activo } });
  });
}

export async function getHistorialRecordatorios(deudorId: string, acreedorId: string, grupoId: string) {
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
    const activos = new Set(config.grupo.miembros.map((m) => m.usuarioId));

    for (const saldo of saldos) {
      if (saldo.monto <= 0 || saldo.acreedorId !== config.configuradoPor || !activos.has(saldo.deudorId)) continue;
      const pendiente = await unpaidAfterReported(config.grupoId, saldo.deudorId, saldo.acreedorId, saldo.monto);
      if (pendiente <= 0) continue;

      // Check if enough days have passed since last reminder
      const tooSoon = async (db: typeof prisma | Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) => {
        const ultimo = await db.recordatorio.findFirst({
          where: { enviadoA: saldo.deudorId, grupoId: config.grupoId, tipo: 'automatico' },
          orderBy: { fechaEnvio: 'desc' },
        });
        return !!ultimo && (Date.now() - ultimo.fechaEnvio.getTime()) / 86_400_000 < config.frecuenciaDias;
      };
      if (await tooSoon(prisma)) continue;

      // Count all reminders for escalation
      const numRecordatorios = await prisma.recordatorio.count({
        where: { enviadoA: saldo.deudorId, grupoId: config.grupoId },
      });

      const [acreedor, deudor, grupo] = await Promise.all([
        prisma.usuario.findUnique({ where: { id: saldo.acreedorId }, select: { nombre: true } }),
        prisma.usuario.findUnique({
          where: { id: saldo.deudorId },
          select: { nombre: true, expoPushToken: true },
        }),
        prisma.grupo.findUnique({ where: { id: config.grupoId }, select: { nombre: true } }),
      ]);

      if (!acreedor || !deudor || !grupo) continue;

      const tono: Tono = numRecordatorios === 0 ? 'suave' : numRecordatorios === 1 ? 'directo' : 'urgente';
      const mensaje = buildMensaje(
        acreedor.nombre,
        deudor.nombre,
        pendiente,
        grupo.nombre,
        tono,
        numRecordatorios
      );

      // Several API instances run this job: the lock and re-check let only one of them send.
      const created = await prisma.$transaction(async (tx) => {
        await transactionLock(tx, `auto-reminder:${config.grupoId}:${saldo.deudorId}`);
        if (await tooSoon(tx)) return false;
        await tx.recordatorio.create({
          data: {
            enviadoPor: saldo.acreedorId,
            enviadoA: saldo.deudorId,
            grupoId: config.grupoId,
            monto: pendiente,
            tipo: 'automatico',
            tono,
            mensaje,
          },
        });
        return true;
      });

      if (created && deudor.expoPushToken) {
        await sendPushNotification(deudor.expoPushToken, 'Recordatorio de deuda', mensaje, {
          grupoId: config.grupoId,
          type: 'recordatorio_automatico',
        });
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
    select: { id: true, nombre: true, modo: true, fechaLimite: true, miembros: { where: { activo: true }, select: { usuarioId: true } } },
  });
  let sent = 0;
  for (const grupo of grupos) {
    const stage = deadlineStage(now, grupo.fechaLimite!);
    if (!stage) continue;
    const activos = new Set(grupo.miembros.map((m) => m.usuarioId));
    for (const saldo of await calcularSaldosGrupo(grupo.id)) {
      if (saldo.monto <= 0 || !activos.has(saldo.deudorId) || !activos.has(saldo.acreedorId)) continue;
      const pendiente = await unpaidAfterReported(grupo.id, saldo.deudorId, saldo.acreedorId, saldo.monto);
      if (pendiente <= 0) continue;
      const mensaje = deadlineMessage(stage, pendiente, grupo.nombre, grupo.fechaLimite!, grupo.modo === 'division');
      // Several API instances run this job: the lock and re-check let only one of them send.
      // Reminders from an earlier deadline (the date was moved) do not count.
      const created = await prisma.$transaction(async (tx) => {
        await transactionLock(tx, `deadline-reminder:${grupo.id}:${saldo.deudorId}:${saldo.acreedorId}`);
        const already = await tx.recordatorio.findFirst({
          where: { grupoId: grupo.id, enviadoA: saldo.deudorId, enviadoPor: saldo.acreedorId, tipo: stage, fechaEnvio: { gte: new Date(grupo.fechaLimite!.getTime() - 4 * 86_400_000) } },
          select: { id: true },
        });
        if (already) return false;
        await tx.recordatorio.create({
          data: { enviadoPor: saldo.acreedorId, enviadoA: saldo.deudorId, grupoId: grupo.id, monto: pendiente, tipo: stage, fechaEnvio: now, tono: stage.startsWith('limite-v') ? 'directo' : 'suave', mensaje },
        });
        return true;
      });
      if (!created) continue;
      sent += 1;
      const late = stage.startsWith('limite-v') || stage === 'limite-d0';
      const deudor = await prisma.usuario.findUnique({ where: { id: saldo.deudorId }, select: { expoPushToken: true, email: true, nombre: true, activo: true } });
      if (deudor?.expoPushToken) {
        void sendPushNotification(deudor.expoPushToken, late ? 'Tu pago está vencido' : 'Se acerca la fecha límite', mensaje, { grupoId: grupo.id, type: 'recordatorio_fecha' })
          .catch(() => console.error('[Notification] Deadline reminder saved; push delivery failed'));
      }
      // E-mail too: web users get no push. Once per stage, like the push, and never blocking the job.
      if (deudor?.activo && deudor.email && emailProvider()) {
        void deliver({ to: deudor.email, ...renderDeadlineEmail({ nombre: deudor.nombre, grupo: grupo.nombre, mensaje, late, grupoId: grupo.id, publicUrl: process.env.PUBLIC_WEB_URL }) })
          .catch(() => console.error('[Notification] Deadline reminder saved; e-mail delivery failed'));
      }
    }
  }
  return sent;
}
