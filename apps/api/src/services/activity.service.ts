import { prisma } from '../lib/prisma';

type Person = { id: string; nombre: string };
const first = (person: Person) => person.nombre.trim().split(/\s+/)[0] || person.nombre;

/**
 * Payment events written from the viewer's point of view, so "Luis dice que te pagó" reads as an action.
 * `apruebo` = the viewer is an admin allowed to approve payments in that group.
 */
export function describePayment(
  pago: { estado: string; pagador: Person; receptor: Person; grupo: { nombre: string }; resolutor?: Person | null },
  userId: string,
  apruebo = false,
) {
  const payerIsMe = pago.pagador.id === userId;
  const receiverIsMe = pago.receptor.id === userId;
  const payer = first(pago.pagador);
  const receiver = first(pago.receptor);
  const byAdmin = pago.resolutor && pago.resolutor.id !== pago.receptor.id ? pago.resolutor : null;
  switch (pago.estado) {
    case 'reportado':
      return receiverIsMe
        ? { titulo: `${payer} dice que te pagó`, detalle: `${pago.grupo.nombre} · ¿Lo recibiste?`, requiereAccion: true }
        : payerIsMe
          ? { titulo: `Registraste un pago a ${receiver}`, detalle: `${pago.grupo.nombre} · Esperando que ${receiver} confirme`, requiereAccion: false }
          : apruebo
            ? { titulo: `${payer} registró un pago a ${receiver}`, detalle: `${pago.grupo.nombre} · Revisa el comprobante y apruébalo`, requiereAccion: true }
            : { titulo: `${payer} registró un pago a ${receiver}`, detalle: `${pago.grupo.nombre} · Pendiente de confirmación`, requiereAccion: false };
    case 'exitoso':
      if (byAdmin) {
        const admin = byAdmin.id === userId ? 'Aprobaste' : `${first(byAdmin)} aprobó`;
        return {
          titulo: payerIsMe ? `${admin} tu pago a ${receiver}` : receiverIsMe ? `${admin} el pago de ${payer} para ti` : `${admin} el pago de ${payer} a ${receiver}`,
          detalle: `${pago.grupo.nombre} · Aprobado por el administrador`,
          requiereAccion: false,
        };
      }
      return {
        titulo: receiverIsMe ? `Confirmaste el pago de ${payer}` : payerIsMe ? `${receiver} confirmó tu pago` : `${receiver} confirmó el pago de ${payer}`,
        detalle: `${pago.grupo.nombre} · Confirmado`,
        requiereAccion: false,
      };
    case 'rechazado':
      return {
        titulo: receiverIsMe ? `Indicaste que no recibiste el pago de ${payer}` : payerIsMe ? `${receiver} no confirmó tu pago` : `${receiver} no confirmó el pago de ${payer}`,
        detalle: `${pago.grupo.nombre} · La deuda sigue pendiente`,
        requiereAccion: false,
      };
    default:
      return { titulo: `Pago a ${receiver} cancelado`, detalle: `${pago.grupo.nombre} · La cuenta que debía confirmarlo ya no existe`, requiereAccion: false };
  }
}

export async function getActivity(userId: string, grupoId?: string) {
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId: userId, activo: true, ...(grupoId ? { grupoId } : {}) }, select: { grupoId: true, rol: true, grupo: { select: { aprobacionPagos: true } } } });
  const approves = new Set(memberships.filter((m) => m.rol === 'admin' && m.grupo.aprobacionPagos === 'administrador').map((m) => m.grupoId));
  const groupIds = memberships.map((member) => member.grupoId);
  const person = { select: { id: true, nombre: true } } as const;
  const [expenses, payments] = await Promise.all([
    prisma.gasto.findMany({ where: { grupoId: { in: groupIds }, activo: true }, include: { creador: person, grupo: { select: { nombre: true } }, participantes: { where: { usuarioId: userId }, select: { montoAsignado: true } } }, orderBy: { fecha: 'desc' }, take: 80 }),
    prisma.pago.findMany({ where: { grupoId: { in: groupIds } }, include: { pagador: person, receptor: person, resolutor: person, grupo: { select: { nombre: true } } }, orderBy: { fechaPago: 'desc' }, take: 80 }),
  ]);
  return [
    ...expenses.map((e) => ({
      id: `expense-${e.id}`,
      tipo: 'gasto',
      titulo: e.creadoPor === userId ? `Agregaste “${e.descripcion}”` : `${first(e.creador)} agregó “${e.descripcion}”`,
      detalle: e.grupo.nombre,
      monto: e.montoTotal,
      fecha: e.fecha,
      grupoId: e.grupoId,
      gastoId: e.id,
      pagoId: null,
      // What the viewer owes for this expense (null when it does not involve them).
      tuParte: e.participantes[0]?.montoAsignado ?? null,
      pagaste: e.pagadoPor === userId,
      requiereAccion: false,
    })),
    ...payments.map((p) => ({
      id: `payment-${p.id}`,
      tipo: 'pago',
      ...describePayment(p, userId, approves.has(p.grupoId)),
      monto: p.monto,
      fecha: p.fechaResolucion || p.fechaPago,
      grupoId: p.grupoId,
      gastoId: null,
      pagoId: p.id,
      tuParte: null,
      pagaste: false,
      estado: p.estado,
    })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 100);
}
