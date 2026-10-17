import { UserError } from './errors';
export type ExpensePayer = { usuarioId: string; monto: number; concepto?: string | null };
export type WithPayers = { montoTotal: number; pagadoPor: string; pagadores?: ExpensePayer[] };

/** Legacy single-payer rows need no backfill, and must keep exactly the same balances. */
export function expensePayers(expense: WithPayers): ExpensePayer[] {
  return expense.pagadores?.length ? expense.pagadores : [{ usuarioId: expense.pagadoPor, monto: expense.montoTotal }];
}
export function validatePayers(expense: WithPayers) {
  const rows = expensePayers(expense);
  if (expense.pagadores && !expense.pagadores.length) throw new UserError('Elige quién pagó el gasto.');
  if (rows.length > 50 || new Set(rows.map(row => row.usuarioId)).size !== rows.length)
    throw new UserError('Elige hasta 50 pagadores distintos, sin repetir personas.');
  if (rows.some(row => !Number.isSafeInteger(row.monto) || row.monto <= 0 || row.monto > 999_999_999))
    throw new UserError('Escribe cuánto adelantó cada persona, con un monto mayor que cero.');
  if (!rows.some(row => row.usuarioId === expense.pagadoPor)) throw new UserError('El pagador principal debe estar entre quienes adelantaron dinero.');
  if (rows.reduce((sum, row) => sum + row.monto, 0) !== expense.montoTotal)
    throw new UserError('Lo que adelantaron los pagadores debe sumar exactamente el total del gasto.');
  return rows;
}
