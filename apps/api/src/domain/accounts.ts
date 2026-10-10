import { simplifyNetBalances } from './money';
export interface AccountMember { id: string; nombre: string }
export interface AccountExpense { montoTotal: number; pagadoPor: string; participantes: Array<{ usuarioId: string; montoAsignado: number }> }
export interface AccountPayment { pagadorId: string; receptorId: string; monto: number; estado: string }
export function calculateAccounts(members: AccountMember[], expenses: AccountExpense[], payments: AccountPayment[]) {
  const confirmed = payments.filter((p) => p.estado === 'exitoso');
  const cuentas = members.map((member) => {
    const pagaste = expenses.filter((e) => e.pagadoPor === member.id).reduce((sum, e) => sum + e.montoTotal, 0);
    const tuParte = expenses.reduce((sum, e) => sum + e.participantes.filter((p) => p.usuarioId === member.id).reduce((value, p) => value + p.montoAsignado, 0), 0);
    const pagosEnviados = confirmed.filter((p) => p.pagadorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    const pagosRecibidos = confirmed.filter((p) => p.receptorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    const pagosPorConfirmar = payments.filter((p) => p.estado === 'reportado' && p.pagadorId === member.id).reduce((sum, p) => sum + p.monto, 0);
    return { usuarioId: member.id, nombre: member.nombre, pagaste, tuParte, pagosEnviados, pagosRecibidos, pagosPorConfirmar, neto: pagaste - tuParte + pagosEnviados - pagosRecibidos };
  });
  const debtors = cuentas.filter((a) => a.neto < 0).map((a) => ({ id: a.usuarioId, nombre: a.nombre, monto: -a.neto }));
  const creditors = cuentas.filter((a) => a.neto > 0).map((a) => ({ id: a.usuarioId, nombre: a.nombre, monto: a.neto }));
  return { totalGastado: expenses.reduce((sum, e) => sum + e.montoTotal, 0), cantidadGastos: expenses.length, cuentas, saldos: simplifyNetBalances(debtors, creditors) };
}
