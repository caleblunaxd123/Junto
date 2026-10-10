import { allocateEqual, type MoneyAllocation } from './money';
import { UserError as Error } from './errors';

export const MAX_PARTS = 100;
interface Participant { usuarioId: string; montoAsignado: number }

/** A bill split in N equal parts, in cents. Index 0 is the payer's own part; the rest go in joining order. */
export function partAmounts(total: number, partes: number): number[] {
  if (!Number.isInteger(partes) || partes < 2 || partes > MAX_PARTS) throw new Error(`Divide la cuenta entre 2 y ${MAX_PARTS} personas.`);
  if (total < partes) throw new Error('Cada parte debe ser de al menos S/ 0.01.');
  return allocateEqual(total, Array.from({ length: partes }, (_, index) => String(index))).map((part) => part.montoAsignado);
}

/** Members already in the group take one part each; parts nobody holds yet stay with whoever paid. */
export function allocateParts(total: number, partes: number, payerId: string, people: string[]): MoneyAllocation[] {
  const others = [...new Set(people)].filter((id) => id !== payerId);
  if (others.length + 1 > partes) throw new Error(`Hay ${others.length + 1} personas en esta cuenta: divídela en al menos ${others.length + 1} partes.`);
  const amounts = partAmounts(total, partes);
  const assigned = others.map((usuarioId, index) => ({ usuarioId, montoAsignado: amounts[index + 1] }));
  return [{ usuarioId: payerId, montoAsignado: total - assigned.reduce((sum, part) => sum + part.montoAsignado, 0) }, ...assigned];
}

/**
 * The part a newcomer takes from the payer, or null: already in the bill, no free part left,
 * or the split was changed by hand so the payer no longer holds whole free parts.
 */
export function nextPart(total: number, partes: number, payerId: string, participants: Participant[], newcomerId: string): number | null {
  if (participants.some((p) => p.usuarioId === newcomerId)) return null;
  const holders = participants.filter((p) => p.usuarioId !== payerId).length + 1;
  if (holders >= partes) return null;
  const amounts = partAmounts(total, partes);
  const payer = participants.find((p) => p.usuarioId === payerId);
  if (!payer || payer.montoAsignado - amounts[holders] < amounts[0]) return null;
  return amounts[holders];
}

export function partsSummary(total: number, partes: number, payerId: string, participants: Participant[]) {
  const holders = participants.filter((p) => p.usuarioId !== payerId).length + 1;
  return { partes, parte: partAmounts(total, partes)[0], libres: Math.max(0, partes - holders) };
}
