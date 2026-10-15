import { randomBytes } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { UserError } from '../domain/errors';
import { calcularSaldosGrupo } from './balance.service';

/** Call after taking the group row lock, so closing cannot race an expense or invitation. */
export async function requireOpenGroup(tx: Prisma.TransactionClient, grupoId: string) {
  const group = await tx.grupo.findUnique({ where: { id: grupoId }, select: { activo: true, estado: true } });
  if (!group?.activo) throw new UserError('Grupo no encontrado.', 404);
  if (group.estado !== 'abierto') throw new UserError('Este grupo ya no admite gastos ni integrantes nuevos. Un administrador puede reabrirlo desde las opciones del grupo.', 409);
}

export async function groupEvent(tx: Prisma.TransactionClient, grupoId: string, autorId: string, tipo: string, texto: string, detalle: Prisma.InputJsonValue = {}) {
  return tx.eventoGrupo.create({ data: { grupoId, autorId, tipo, texto, detalle } });
}

/** A zero sum across the group is always zero; inspect every debt and every pending payment. */
async function closureState(tx: Prisma.TransactionClient, grupoId: string) {
  const [debts, pending] = await Promise.all([
    calcularSaldosGrupo(grupoId, tx),
    tx.pago.count({ where: { grupoId, estado: 'reportado' } }),
  ]);
  return debts.some(d => d.monto > 0) || pending > 0 ? 'por_liquidar' : 'cerrado';
}

/** Payments still work during settlement. A disputed receipt brings the debt back visibly. */
export async function syncGroupClosure(tx: Prisma.TransactionClient, grupoId: string, autorId: string) {
  const group = await tx.grupo.findUniqueOrThrow({ where: { id: grupoId }, select: { estado: true } });
  if (group.estado === 'abierto') return;
  const estado = await closureState(tx, grupoId);
  if (estado === group.estado) return;
  await tx.grupo.update({ where: { id: grupoId }, data: { estado, cerradoEn: estado === 'cerrado' ? new Date() : null } });
  await groupEvent(tx, grupoId, autorId, estado === 'cerrado' ? 'grupo_cerrado' : 'cierre_rectificado', estado === 'cerrado'
    ? 'Todos quedaron a mano. El grupo está cerrado y las cuentas siguen disponibles.'
    : 'Se rectificó un pago: el grupo vuelve a estar por liquidar. No admite gastos nuevos.');
}

async function lockMember(tx: Prisma.TransactionClient, grupoId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
  const member = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true }, usuario: { activo: true, sinCuenta: false } }, include: { grupo: true } });
  if (!member) throw new UserError('No perteneces a este grupo.', 403);
  return member;
}

export async function changeGroupLifecycle(grupoId: string, userId: string, accion: 'cerrar' | 'reabrir' | 'eliminar-vacio') {
  return prisma.$transaction(async tx => {
    const member = await lockMember(tx, grupoId, userId);
    if (member.rol !== 'admin') throw new UserError('Solo un administrador puede cerrar, reabrir o eliminar el grupo.', 403);
    const group = member.grupo;
    if (accion === 'eliminar-vacio') {
      const [expenses, payments] = await Promise.all([tx.gasto.count({ where: { grupoId } }), tx.pago.count({ where: { grupoId } })]);
      if (expenses || payments) throw new UserError('Este grupo tiene historial de gastos o pagos. Ciérralo para conservar sus cuentas.', 409);
      await tx.grupo.update({ where: { id: grupoId }, data: { activo: false, linkInvitacion: null } });
      await tx.gastoRecurrente.updateMany({ where: { grupoId, activo: true }, data: { activo: false, pausaMotivo: 'El grupo fue eliminado.' } });
      await tx.invitacion.updateMany({ where: { grupoId, estado: 'pendiente' }, data: { estado: 'cancelada', fechaRespuesta: new Date() } });
      await groupEvent(tx, grupoId, userId, 'grupo_eliminado', 'Se eliminó el grupo sin movimientos.');
      return { eliminado: true };
    }
    if (accion === 'reabrir') {
      if (group.estado === 'abierto') return { estado: group.estado };
      await tx.grupo.update({ where: { id: grupoId }, data: { estado: 'abierto', cierreSolicitadoEn: null, cerradoEn: null, linkInvitacion: randomBytes(12).toString('base64url') } });
      // Old personal invitations must stay invalid after reopening, too.
      const placeholders = await tx.grupoMiembro.findMany({ where: { grupoId, activo: true, usuario: { sinCuenta: true } }, select: { id: true } });
      for (const m of placeholders) await tx.grupoMiembro.update({ where: { id: m.id }, data: { codigoPersonal: randomBytes(15).toString('base64url') } });
      await groupEvent(tx, grupoId, userId, 'grupo_reabierto', 'Se reabrió el grupo. Ya se pueden anotar gastos e invitar personas.');
      return { estado: 'abierto' };
    }
    if (group.estado !== 'abierto') return { estado: group.estado };
    const estado = await closureState(tx, grupoId);
    const now = new Date();
    await tx.grupo.update({ where: { id: grupoId }, data: { estado, cierreSolicitadoEn: now, cerradoEn: estado === 'cerrado' ? now : null, linkInvitacion: null } });
    await tx.gastoRecurrente.updateMany({ where: { grupoId, activo: true }, data: { activo: false, pausaMotivo: 'El grupo finalizó sus gastos. Reábrelo y reanuda esta programación si deseas continuar.' } });
    await tx.invitacion.updateMany({ where: { grupoId, estado: 'pendiente' }, data: { estado: 'cancelada', fechaRespuesta: now } });
    await groupEvent(tx, grupoId, userId, estado === 'cerrado' ? 'grupo_cerrado' : 'cierre_solicitado', estado === 'cerrado'
      ? 'Se cerró el grupo. Todos quedaron a mano y las cuentas siguen disponibles.'
      : 'Se finalizaron los gastos. El grupo está por liquidar: todavía se puede pagar y confirmar pagos.');
    return { estado };
  });
}

export async function archiveGroup(grupoId: string, userId: string, archivar: boolean) {
  return prisma.$transaction(async tx => {
    const member = await lockMember(tx, grupoId, userId);
    await tx.grupoMiembro.update({ where: { id: member.id }, data: { archivadoEn: archivar ? member.archivadoEn ?? new Date() : null } });
    return { archivado: archivar };
  });
}
