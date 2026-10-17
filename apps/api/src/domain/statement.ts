/**
 * "Tu estado de cuenta" in one group: every expense you paid or share and every payment you sent or
 * received, oldest first, with a running balance. Only confirmed payments move the balance; reported
 * or rejected ones are listed with zero effect. The last balance equals the ledger's net exactly.
 */
import { expensePayers, type ExpensePayer } from './expensePayers';
export interface StatementExpense {
  id: string; descripcion: string; categoria: string; fecha: Date; fechaRegistro: Date;
  montoTotal: number; pagadoPor: string; pagadorNombre: string;
  pagadores?: ExpensePayer[];
  participantes: Array<{ usuarioId: string; montoAsignado: number }>;
}
export interface StatementPayment {
  id: string; pagadorId: string; pagadorNombre: string; receptorId: string; receptorNombre: string;
  monto: number; estado: string; metodo: string | null; fechaPago: Date; fechaEfectiva: Date | null; conComprobante: boolean;
}
export type StatementEntry =
  | { tipo: 'gasto'; id: string; fecha: string; descripcion: string; categoria: string; monto: number; pagadorId: string; pagadorNombre: string; pagaste: number; tuParte: number; efecto: number; saldo: number }
  | { tipo: 'pago'; id: string; fecha: string; sentido: 'enviado' | 'recibido'; contraparteId: string; contraparteNombre: string; monto: number; metodo: string | null; estado: string; conComprobante: boolean; efecto: number; saldo: number };


export function buildStatement(userId: string, expenses: StatementExpense[], payments: StatementPayment[]) {
  // Ordered by when it was written down (the real sequence); each row shows its own business date:
  // an expense's moment (format it in local time) or a payment's calendar day (AAAA-MM-DD).
  type Row = { at: number; key: string; make: (saldo: number) => StatementEntry; efecto: number };
  const rows: Row[] = [];
  for (const e of expenses) {
    const tuParte = e.participantes.filter((p) => p.usuarioId === userId).reduce((sum, p) => sum + p.montoAsignado, 0);
    const pagaste = expensePayers(e).filter(p => p.usuarioId === userId).reduce((sum, p) => sum + p.monto, 0);
    if (!tuParte && !pagaste) continue; // Not yours: it does not change your balance.
    const efecto = pagaste - tuParte;
    rows.push({ at: e.fechaRegistro.getTime(), key: `gasto-${e.id}`, efecto, make: (saldo) => ({
      tipo: 'gasto', id: e.id, fecha: e.fecha.toISOString(), descripcion: e.descripcion, categoria: e.categoria, monto: e.montoTotal,
      pagadorId: e.pagadoPor, pagadorNombre: e.pagadorNombre, pagaste, tuParte, efecto, saldo,
    }) });
  }
  for (const p of payments) {
    const sent = p.pagadorId === userId;
    if (!sent && p.receptorId !== userId) continue;
    const efecto = p.estado === 'exitoso' ? (sent ? p.monto : -p.monto) : 0;
    rows.push({ at: p.fechaPago.getTime(), key: `pago-${p.id}`, efecto, make: (saldo) => ({
      tipo: 'pago', id: p.id, fecha: p.fechaEfectiva ? p.fechaEfectiva.toISOString().slice(0, 10) : p.fechaPago.toISOString(), sentido: sent ? 'enviado' : 'recibido',
      contraparteId: sent ? p.receptorId : p.pagadorId, contraparteNombre: sent ? p.receptorNombre : p.pagadorNombre,
      monto: p.monto, metodo: p.metodo, estado: p.estado, conComprobante: p.conComprobante, efecto, saldo,
    }) });
  }
  rows.sort((a, b) => a.at - b.at || a.key.localeCompare(b.key));
  let saldo = 0;
  const movimientos = rows.map((row) => { saldo += row.efecto; return row.make(saldo); });
  const gastos = movimientos.filter((m): m is Extract<StatementEntry, { tipo: 'gasto' }> => m.tipo === 'gasto');
  const pagos = movimientos.filter((m): m is Extract<StatementEntry, { tipo: 'pago' }> => m.tipo === 'pago' && m.estado === 'exitoso');
  const categories = new Map<string, number>();
  for (const g of gastos) if (g.tuParte) categories.set(g.categoria || 'otro', (categories.get(g.categoria || 'otro') ?? 0) + g.tuParte);
  return {
    movimientos: movimientos.map((m, i) => ({ ...m, fechaRegistro: new Date(rows[i].at).toISOString() })),
    porCategoria: [...categories].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto || a.categoria.localeCompare(b.categoria)),
    totales: {
      tuParte: gastos.reduce((sum, g) => sum + g.tuParte, 0),          // what you consumed
      pagasteEnGastos: gastos.reduce((sum, g) => sum + g.pagaste, 0),  // what you put up front
      pagosEnviados: pagos.filter((p) => p.sentido === 'enviado').reduce((sum, p) => sum + p.monto, 0),
      pagosRecibidos: pagos.filter((p) => p.sentido === 'recibido').reduce((sum, p) => sum + p.monto, 0),
      saldo,                                                            // > 0: te deben; < 0: debes
    },
  };
}
