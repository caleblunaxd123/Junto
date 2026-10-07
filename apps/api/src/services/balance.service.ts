import { prisma } from '../lib/prisma';
import { calculateAccounts } from '../domain/accounts';
export interface Saldo { deudorId: string; deudorNombre: string; acreedorId: string; acreedorNombre: string; monto: number }
export async function resumenCuentasGrupo(grupoId: string) {
  // One snapshot: totals and settlement edges must describe the same ledger.
  const [members, expenses, payments] = await prisma.$transaction([
    prisma.grupoMiembro.findMany({ where: { grupoId }, include: { usuario: { select: { id: true, nombre: true } } } }),
    prisma.gasto.findMany({ where: { grupoId, activo: true }, include: { participantes: true } }),
    prisma.pago.findMany({ where: { grupoId } }),
  ], { isolationLevel: 'RepeatableRead' });
  return calculateAccounts(members.map((member) => member.usuario), expenses, payments);
}
export async function calcularSaldosGrupo(grupoId: string): Promise<Saldo[]> { return (await resumenCuentasGrupo(grupoId)).saldos; }
export async function balancePersonal(usuarioId: string) {
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId, activo: true, grupo: { activo: true } }, select: { grupoId: true } });
  const balances = await Promise.all(memberships.map(({ grupoId }) => calcularSaldosGrupo(grupoId)));
  const teDeben = balances.flat().filter((s) => s.acreedorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
  const debes = balances.flat().filter((s) => s.deudorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
  return { total: teDeben - debes, teDeben, debes };
}
