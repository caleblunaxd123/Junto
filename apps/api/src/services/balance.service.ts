import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { calculateAccounts } from '../domain/accounts';
export interface Saldo { deudorId: string; deudorNombre: string; acreedorId: string; acreedorNombre: string; monto: number }
/**
 * The group's ledger. Inside an interactive transaction pass `tx`: reading through the global client
 * there would need a second pool connection while the first one is held (and can exhaust the pool).
 */
export async function resumenCuentasGrupo(grupoId: string, tx?: Prisma.TransactionClient) {
  const queries = (db: Prisma.TransactionClient | typeof prisma) => [
    db.grupoMiembro.findMany({ where: { grupoId }, include: { usuario: { select: { id: true, nombre: true } } } }),
    db.gasto.findMany({ where: { grupoId, activo: true }, include: { participantes: true } }),
    db.pago.findMany({ where: { grupoId } }),
  ] as const;
  // One snapshot: totals and settlement edges must describe the same ledger.
  const [members, expenses, payments] = tx
    ? await Promise.all(queries(tx))
    : await prisma.$transaction([...queries(prisma)], { isolationLevel: 'RepeatableRead' });
  return calculateAccounts(members.map((member) => member.usuario), expenses, payments);
}
export async function calcularSaldosGrupo(grupoId: string, tx?: Prisma.TransactionClient): Promise<Saldo[]> { return (await resumenCuentasGrupo(grupoId, tx)).saldos; }
export async function balancePersonal(usuarioId: string) {
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId, activo: true, grupo: { activo: true } }, select: { grupoId: true } });
  const balances = await Promise.all(memberships.map(({ grupoId }) => calcularSaldosGrupo(grupoId)));
  const teDeben = balances.flat().filter((s) => s.acreedorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
  const debes = balances.flat().filter((s) => s.deudorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
  return { total: teDeben - debes, teDeben, debes };
}
