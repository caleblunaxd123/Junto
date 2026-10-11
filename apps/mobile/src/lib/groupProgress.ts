import type { CuentaPorPartes, GrupoConBalance } from "../types";

/** Also works with the older API: derive the exact vacant shares, never multiply a rounded part. */
export function freeParts(bill: Pick<CuentaPorPartes, "montoTotal" | "partes" | "libres">): number[] {
  const base = Math.floor(bill.montoTotal / bill.partes);
  const remainder = bill.montoTotal % bill.partes;
  return Array.from({ length: bill.libres }, (_, index) => base + (bill.partes - bill.libres + index < remainder ? 1 : 0));
}

export function heldParts(group: GrupoConBalance, userId: string): number {
  const bills = group.cuentasPorPartes ?? (group.cuenta ? [group.cuenta] : []);
  return bills.filter((bill) => bill.pagadoPor === userId).reduce((sum, bill) => sum + freeParts(bill).reduce((a, b) => a + b, 0), 0);
}

/** Net reimbursements of the whole ledger, not gross transfers or just the first bill. */
export function groupProgress(group: GrupoConBalance) {
  const total = group.resumen.totalGastado;
  const free = group.resumen.cuentas.reduce((sum, account) => sum + heldParts(group, account.usuarioId), 0);
  const pending = group.resumen.cuentas.reduce((sum, account) => sum + Math.max(0, -account.neto), 0);
  const goal = group.modo === "division" ? total : group.resumen.cuentas.reduce((sum, account) => sum + Math.max(0, account.pagaste - account.tuParte + heldParts(group, account.usuarioId)), 0);
  const done = Math.max(0, Math.min(goal, goal - pending - free));
  return { total, free, pending, goal, done, progress: goal > 0 ? done / goal : 0 };
}
