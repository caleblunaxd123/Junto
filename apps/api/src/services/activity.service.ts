import { prisma } from '../lib/prisma';
export async function getActivity(userId: string, grupoId?: string) {
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId: userId, activo: true, ...(grupoId ? { grupoId } : {}) }, select: { grupoId: true } });
  const groupIds = memberships.map((member) => member.grupoId);
  const [expenses, payments] = await Promise.all([
    prisma.gasto.findMany({ where: { grupoId: { in: groupIds }, activo: true }, include: { creador: { select: { nombre: true } }, grupo: { select: { nombre: true } } }, orderBy: { fecha: 'desc' }, take: 80 }),
    prisma.pago.findMany({ where: { grupoId: { in: groupIds } }, include: { pagador: { select: { nombre: true } }, receptor: { select: { nombre: true } }, grupo: { select: { nombre: true } } }, orderBy: { fechaPago: 'desc' }, take: 80 }),
  ]);
  return [
    ...expenses.map((e) => ({ id: `expense-${e.id}`, tipo: 'gasto', titulo: `${e.creador.nombre} agregó “${e.descripcion}”`, detalle: e.grupo.nombre, monto: e.montoTotal, fecha: e.fecha, grupoId: e.grupoId, gastoId: e.id })),
    ...payments.map((p) => ({ id: `payment-${p.id}`, tipo: 'pago', titulo: p.estado === 'exitoso' ? `${p.receptor.nombre} confirmó el pago de ${p.pagador.nombre}` : p.estado === 'rechazado' ? `${p.receptor.nombre} rechazó el registro de ${p.pagador.nombre}` : `${p.pagador.nombre} registró un pago a ${p.receptor.nombre}`, detalle: `${p.grupo.nombre} · ${p.estado === 'reportado' ? 'Pendiente de confirmación' : p.estado === 'exitoso' ? 'Confirmado' : 'Rechazado'}`, monto: p.monto, fecha: p.fechaResolucion || p.fechaPago, grupoId: p.grupoId, gastoId: null })),
  ].sort((a, b) => b.fecha.getTime() - a.fecha.getTime()).slice(0, 100);
}
