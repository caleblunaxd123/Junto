import { prisma } from '../lib/prisma';
import { UserError as Error } from '../domain/errors';
import { buildStatement } from '../domain/statement';
import { calculateAccounts } from '../domain/accounts';
import { createHash } from 'node:crypto';

/** The viewer's own statement in a group ("Sacar cuentas"): only members, only their rows. */
export async function groupStatement(userId: string, grupoId: string) {
  return prisma.$transaction(async (tx) => {
    const member = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { usuario: { select: { nombre: true } }, grupo: { select: { nombre: true, moneda: true, simplificarDeudas: true, estado: true, cerradoEn: true } } } });
    if (!member) throw new Error('No perteneces a este grupo', 403);
    // One snapshot, like the ledger: rows and totals describe the same moment.
    const [members, expenses, payments] = await Promise.all([
      tx.grupoMiembro.findMany({ where: { grupoId }, select: { activo: true, usuario: { select: { id: true, nombre: true } } } }),
      tx.gasto.findMany({ where: { grupoId, activo: true }, select: { id: true, descripcion: true, categoria: true, fecha: true, fechaRegistro: true, montoTotal: true, pagadoPor: true, pagadores: { include: { usuario: { select: { nombre: true } } } }, pagador: { select: { nombre: true } }, participantes: { select: { usuarioId: true, montoAsignado: true } } } }),
      tx.pago.findMany({ where: { grupoId }, select: { id: true, pagadorId: true, receptorId: true, monto: true, estado: true, metodo: true, fechaPago: true, fechaEfectiva: true, pagador: { select: { nombre: true } }, receptor: { select: { nombre: true } }, comprobante: { select: { id: true } } } }),
    ]);
    const accounts = calculateAccounts(members.map((m) => ({ ...m.usuario, activo: m.activo })), expenses, payments, member.grupo.simplificarDeudas);
    const saldos = accounts.saldos.filter((s) => s.deudorId === userId || s.acreedorId === userId);
    const statement = {
      titular: { id: userId, nombre: member.usuario.nombre },
      grupo: { nombre: member.grupo.nombre, moneda: member.grupo.moneda, estado: member.grupo.estado, cerradoEn: member.grupo.cerradoEn?.toISOString() ?? null },
      ...buildStatement(userId,
        expenses.map((e) => ({ ...e, pagadorNombre: e.pagadores.length ? e.pagadores.map(p => p.usuario.nombre).join(', ') : e.pagador.nombre,
          aportes: e.pagadores.map((p) => ({ usuarioId: p.usuarioId, nombre: p.usuario.nombre, monto: p.monto, concepto: p.concepto })) })),
        payments.map((p) => ({ ...p, pagadorNombre: p.pagador.nombre, receptorNombre: p.receptor.nombre, conComprobante: !!p.comprobante }))),
      saldos,
      balance: {
        teDeben: saldos.filter((s) => s.acreedorId === userId).reduce((sum, s) => sum + s.monto, 0),
        debes: saldos.filter((s) => s.deudorId === userId).reduce((sum, s) => sum + s.monto, 0),
      },
    };
    return { ...statement, version: createHash('sha256').update(JSON.stringify(statement)).digest('hex') };
  }, { isolationLevel: 'RepeatableRead' });
}
