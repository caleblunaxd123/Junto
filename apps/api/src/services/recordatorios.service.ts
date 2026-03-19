import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/firebase';
import { calcularSaldosGrupo } from './balance.service';

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
  if (!deuda || deuda.monto <= 0) throw new Error('No existe deuda de este usuario hacia ti');

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

  if (!acreedor || !deudor || !grupo) throw new Error('Datos no encontrados');

  const mensaje = buildMensaje(
    acreedor.nombre,
    deudor.nombre,
    deuda.monto,
    grupo.nombre,
    tono,
    numRecordatorios
  );

  const recordatorio = await prisma.recordatorio.create({
    data: {
      enviadoPor: acreedorId,
      enviadoA: deudorId,
      grupoId,
      monto: deuda.monto,
      tipo: 'manual',
      tono,
      mensaje,
    },
  });

  // Send push notification
  if (deudor.expoPushToken) {
    await sendPushNotification(
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

  const config = await prisma.configRecordatorio.upsert({
    where: { id: (await prisma.configRecordatorio.findFirst({ where: { grupoId, configuradoPor: usuarioId } }))?.id || '' },
    create: { grupoId, configuradoPor: usuarioId, frecuenciaDias, activo },
    update: { frecuenciaDias, activo },
  });

  return config;
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

  const configs = await prisma.configRecordatorio.findMany({
    where: { activo: true },
    include: { grupo: { include: { miembros: { where: { activo: true } } } } },
  });

  for (const config of configs) {
    const saldos = await calcularSaldosGrupo(config.grupoId);

    for (const saldo of saldos) {
      if (saldo.monto <= 0) continue;

      // Check if enough days have passed since last reminder
      const ultimoRecordatorio = await prisma.recordatorio.findFirst({
        where: {
          enviadoA: saldo.deudorId,
          grupoId: config.grupoId,
          tipo: 'automatico',
        },
        orderBy: { fechaEnvio: 'desc' },
      });

      const diasDesdeUltimo = ultimoRecordatorio
        ? (Date.now() - ultimoRecordatorio.fechaEnvio.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      if (diasDesdeUltimo < config.frecuenciaDias) continue;

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
        saldo.monto,
        grupo.nombre,
        tono,
        numRecordatorios
      );

      await prisma.recordatorio.create({
        data: {
          enviadoPor: saldo.acreedorId,
          enviadoA: saldo.deudorId,
          grupoId: config.grupoId,
          monto: saldo.monto,
          tipo: 'automatico',
          tono,
          mensaje,
        },
      });

      if (deudor.expoPushToken) {
        await sendPushNotification(deudor.expoPushToken, 'Recordatorio de deuda', mensaje, {
          grupoId: config.grupoId,
          type: 'recordatorio_automatico',
        });
      }
    }
  }

  console.info('[Cron] Automatic reminders done');
}
