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
    db.grupo.findUnique({ where: { id: grupoId }, select: { simplificarDeudas: true } }),
  ] as const;
  // One snapshot: totals and settlement edges must describe the same ledger.
  const [members, expenses, payments, group] = tx
    ? await Promise.all(queries(tx))
    : await prisma.$transaction([...queries(prisma)], { isolationLevel: 'RepeatableRead' });
  return calculateAccounts(members.map((member) => ({ ...member.usuario, activo: member.activo })), expenses, payments, group?.simplificarDeudas ?? true);
}
export async function calcularSaldosGrupo(grupoId: string, tx?: Prisma.TransactionClient): Promise<Saldo[]> { return (await resumenCuentasGrupo(grupoId, tx)).saldos; }
export async function balancePersonal(usuarioId: string) {
  const memberships = await prisma.grupoMiembro.findMany({ where: { usuarioId, activo: true, grupo: { activo: true } }, select: { grupoId: true, grupo: { select: { moneda: true } } } });
  const balances = await Promise.all(memberships.map(async ({ grupoId, grupo }) => ({ moneda: grupo.moneda, saldos: await calcularSaldosGrupo(grupoId) })));
  // Never add minor units from different currencies into a personal total.
  const buckets = new Map<string, { moneda: string; teDeben: number; debes: number; total: number }>();
  for (const { moneda, saldos } of balances) {
    const bucket = buckets.get(moneda) ?? { moneda, teDeben: 0, debes: 0, total: 0 };
    bucket.teDeben += saldos.filter((s) => s.acreedorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
    bucket.debes += saldos.filter((s) => s.deudorId === usuarioId).reduce((sum, s) => sum + s.monto, 0);
    bucket.total = bucket.teDeben - bucket.debes;
    buckets.set(moneda, bucket);
  }
  const porMoneda = [...buckets.values()];
  const single = porMoneda.length <= 1 ? porMoneda[0] ?? { moneda: 'PEN', total: 0, teDeben: 0, debes: 0 } : null;
  return { porMoneda, moneda: single?.moneda ?? null, total: single?.total ?? null, teDeben: single?.teDeben ?? null, debes: single?.debes ?? null };
}
