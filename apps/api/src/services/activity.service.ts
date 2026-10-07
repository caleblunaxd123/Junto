import { prisma } from '../lib/prisma';

type Person = { id: string; nombre: string };
const first = (person: Person) => person.nombre.trim().split(/\s+/)[0] || person.nombre;

/** Payment events written from the viewer's point of view, so "Luis dice que te pagó" reads as an action. */
export function describePayment(
  pago: { estado: string; pagador: Person; receptor: Person; grupo: { nombre: string } },
  userId: string,
) {
  const payerIsMe = pago.pagador.id === userId;
  const receiverIsMe = pago.receptor.id === userId;
  const payer = first(pago.pagador);
  const receiver = first(pago.receptor);
  switch (pago.estado) {
    case 'reportado':
      return receiverIsMe
        ? { titulo: `${payer} dice que te pagó`, detalle: `${pago.grupo.nombre} · ¿Lo recibiste?`, requiereAccion: true }
        : payerIsMe
          ? { titulo: `Registraste un pago a ${receiver}`, detalle: `${pago.grupo.nombre} · Esperando que ${receiver} confirme`, requiereAccion: false }
          : { titulo: `${payer} registró un pago a ${receiver}`, detalle: `${pago.grupo.nombre} · Pendiente de confirmación`, requiereAccion: false };
    case 'exitoso':
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
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId: userId, activo: true, ...(grupoId ? { grupoId } : {}) }, select: { grupoId: true } });
  const groupIds = memberships.map((member) => member.grupoId);
  const person = { select: { id: true, nombre: true } } as const;
  const [expenses, payments] = await Promise.all([
    prisma.gasto.findMany({ where: { grupoId: { in: groupIds }, activo: true }, include: { creador: person, grupo: { select: { nombre: true } }, participantes: { where: { usuarioId: userId }, select: { montoAsignado: true } } }, orderBy: { fecha: 'desc' }, take: 80 }),
    prisma.pago.findMany({ where: { grupoId: { in: groupIds } }, include: { pagador: person, receptor: person, grupo: { select: { nombre: true } } }, orderBy: { fechaPago: 'desc' }, take: 80 }),
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
      ...describePayment(p, userId),
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
