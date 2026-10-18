import { simplifyNetBalances } from './money';
import { expensePayers, type ExpensePayer } from './expensePayers';
export interface AccountMember { id: string; nombre: string; activo?: boolean }
export interface AccountExpense { montoTotal: number; pagadoPor: string; pagadores?: ExpensePayer[]; categoria?: string; participantes: Array<{ usuarioId: string; montoAsignado: number }> }
export interface AccountPayment { pagadorId: string; receptorId: string; monto: number; estado: string }
export interface DirectDebt { deudorId: string; acreedorId: string; monto: number }

/**
 * Who owes whom WITHOUT simplifying: every expense makes each participant owe its payer, a confirmed
 * payment reduces what its payer owes its receiver, and each pair is netted. Per person it adds up to
 * the same balance as `neto`; only the number of transfers differs from the simplified plan.
 */
export function directDebts(expenses: AccountExpense[], payments: AccountPayment[]): DirectDebt[] {
  const pairs = new Map<string, number>(); // "a|b" (a < b): positive = a owes b
  const owe = (debtor: string, creditor: string, amount: number) => {
    if (debtor === creditor || !amount) return;
    const [a, b, sign] = debtor < creditor ? [debtor, creditor, 1] : [creditor, debtor, -1];
    const key = `${a}|${b}`;
    pairs.set(key, (pairs.get(key) ?? 0) + sign * amount);
  };
  for (const expense of expenses) {
    const payers = expensePayers(expense);
    if (payers.length === 1) {
      for (const part of expense.participantes) owe(part.usuarioId, payers[0].usuarioId, part.montoAsignado);
      continue;
    }
    // First offset each person's own share against what they advanced. Only the remainder is owed.
    const net = new Map<string, number>();
    for (const payer of payers) net.set(payer.usuarioId, (net.get(payer.usuarioId) ?? 0) + payer.monto);
    for (const part of expense.participantes) net.set(part.usuarioId, (net.get(part.usuarioId) ?? 0) - part.montoAsignado);
    const ordered = [...net].sort(([a], [b]) => a.localeCompare(b));
    const debtors = ordered.filter(([, amount]) => amount < 0).map(([id, amount]) => ({ id, nombre: '', monto: -amount }));
    const creditors = ordered.filter(([, amount]) => amount > 0).map(([id, amount]) => ({ id, nombre: '', monto: amount }));
    for (const debt of simplifyNetBalances(debtors, creditors)) owe(debt.deudorId, debt.acreedorId, debt.monto);
  }
  for (const payment of payments) if (payment.estado === 'exitoso') owe(payment.receptorId, payment.pagadorId, payment.monto);
  return [...pairs].filter(([, amount]) => amount !== 0).map(([key, amount]) => {
    const [a, b] = key.split('|');
    return amount > 0 ? { deudorId: a, acreedorId: b, monto: amount } : { deudorId: b, acreedorId: a, monto: -amount };
  }).sort((x, y) => y.monto - x.monto || x.deudorId.localeCompare(y.deudorId) || x.acreedorId.localeCompare(y.acreedorId));
}

/**
 * `simplify` false (default for new groups): the plan is the direct debts per pair, which is what
 * people expect ("Ana te debe 30"). true: the fewest payments. Both settle every net balance exactly.
 */
export function calculateAccounts(members: AccountMember[], expenses: AccountExpense[], payments: AccountPayment[], simplify = true) {
  const confirmed = payments.filter((p) => p.estado === 'exitoso');
  const cuentas = members.map((member) => {
    const pagaste = expenses.reduce((sum, e) => sum + expensePayers(e).filter(p => p.usuarioId === member.id).reduce((paid, p) => paid + p.monto, 0), 0);
    const tuParte = expenses.reduce((sum, e) => sum + e.participantes.filter((p) => p.usuarioId === member.id).reduce((value, p) => value + p.montoAsignado, 0), 0);
    const pagosEnviados = confirmed.filter((p) => p.pagadorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    const pagosRecibidos = confirmed.filter((p) => p.receptorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    const pagosPorConfirmar = payments.filter((p) => p.estado === 'reportado' && p.pagadorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    return { usuarioId: member.id, nombre: member.nombre, activo: member.activo !== false, pagaste, tuParte, pagosEnviados, pagosRecibidos, pagosPorConfirmar, neto: pagaste - tuParte + pagosEnviados - pagosRecibidos };
  })
    // Someone no longer in the group with nothing recorded (e.g. a name replaced by the person who
    // joined as them) is not part of these accounts. Anyone with history or a balance stays listed.
    .filter((a) => a.activo || a.pagaste || a.tuParte || a.pagosEnviados || a.pagosRecibidos || a.pagosPorConfirmar);
  const debtors = cuentas.filter((a) => a.neto < 0).map((a) => ({ id: a.usuarioId, nombre: a.nombre, monto: -a.neto }));
  const creditors = cuentas.filter((a) => a.neto > 0).map((a) => ({ id: a.usuarioId, nombre: a.nombre, monto: a.neto }));
  // Spending by category (insights): what the group spent, never payments between people.
  const categories = new Map<string, { categoria: string; monto: number; cantidad: number }>();
  for (const expense of expenses) {
    const categoria = expense.categoria || 'otro';
    const row = categories.get(categoria) ?? { categoria, monto: 0, cantidad: 0 };
    row.monto += expense.montoTotal;
    row.cantidad += 1;
    categories.set(categoria, row);
  }
  const deudasDirectas = directDebts(expenses, payments);
  const saldosSimplificados = simplifyNetBalances(debtors, creditors);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.nombre ?? '';
  return {
    totalGastado: expenses.reduce((sum, e) => sum + e.montoTotal, 0),
    cantidadGastos: expenses.length,
    cuentas,
    simplificado: simplify,
    // The plan the group follows: who pays whom.
    saldos: simplify ? saldosSimplificados : deudasDirectas.map((d) => ({ ...d, deudorNombre: nameOf(d.deudorId), acreedorNombre: nameOf(d.acreedorId) })),
    saldosSimplificados,
    deudasDirectas,
    porCategoria: [...categories.values()].sort((a, b) => b.monto - a.monto || a.categoria.localeCompare(b.categoria)),
  };
}
