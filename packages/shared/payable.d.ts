export function payableLimit(
  accounts: { usuarioId: string; neto: number }[],
  pending: { pagadorId: string; receptorId: string; monto: number }[],
  payerId: string,
  receiverId: string,
): { owes: number; owed: number; limit: number };
