export function payableLimit(
  accounts: { usuarioId: string; neto: number }[],
  pending: { pagadorId: string; receptorId: string; monto: number }[],
  payerId: string,
  receiverId: string,
  /** Person-to-person groups: the direct debts; the limit is the payer's debt with that receiver. */
  pairs?: { deudorId: string; acreedorId: string; monto: number }[],
): { owes: number; owed: number; limit: number };
