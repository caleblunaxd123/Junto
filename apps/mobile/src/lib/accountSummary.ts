import type { GrupoConBalance, Pago } from "../types";

/** Group debts stay separate. Being owed in A cannot pay your debt in B. */
export function accountSummary(
  groups: GrupoConBalance[],
  payments: Pago[] = [],
) {
  const ids = new Set(groups.map((group) => group.id));
  return {
    owed: groups.reduce((sum, group) => sum + group.balanceUsuario.teDeben, 0),
    owes: groups.reduce((sum, group) => sum + group.balanceUsuario.debes, 0),
    current: groups.filter((group) => group.balanceUsuario.neto === 0).length,
    pending: payments.filter(
      (payment) => ids.has(payment.grupoId) && payment.estado === "reportado",
    ),
  };
}
