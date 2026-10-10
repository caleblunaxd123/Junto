import type { Prisma } from "@prisma/client";
import { nextPart } from "../domain/billParts";

/**
 * Under the group's row lock, right after someone becomes an active member: they take a free part of
 * every bill split in parts, from whoever paid. Returns the cents they now owe for those parts.
 */
export async function takeFreeParts(tx: Prisma.TransactionClient, grupoId: string, usuarioId: string) {
  const bills = await tx.gasto.findMany({ where: { grupoId, activo: true, partes: { not: null } }, include: { participantes: true }, orderBy: { fecha: "asc" } });
  let taken = 0;
  for (const bill of bills) {
    const amount = nextPart(bill.montoTotal, bill.partes!, bill.pagadoPor, bill.participantes, usuarioId);
    if (amount === null) continue;
    // A payer who already left cannot hand over parts: that would move a debt they no longer see.
    if (!(await tx.grupoMiembro.count({ where: { grupoId, usuarioId: bill.pagadoPor, activo: true } }))) continue;
    await tx.gastoParticipante.update({ where: { gastoId_usuarioId: { gastoId: bill.id, usuarioId: bill.pagadoPor } }, data: { montoAsignado: { decrement: amount } } });
    await tx.gastoParticipante.create({ data: { gastoId: bill.id, usuarioId, montoAsignado: amount } });
    taken += amount;
  }
  return taken;
}
