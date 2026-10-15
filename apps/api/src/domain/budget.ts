import { nextOccurrence, type Frecuencia } from './recurrence';

/**
 * Household budget for one calendar month (in the group's local time). "Gastado" is the group's
 * spending dated in that month (payments between people are not spending); "porVenir" is what the
 * group's active recurring expenses will still add before the month ends. Amounts in cents.
 */
export const BUDGET_CATEGORIES = ['alojamiento', 'comida', 'compras', 'transporte', 'entretenimiento', 'otro'] as const;
export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number] | 'total';

export interface BudgetExpense { categoria: string; montoTotal: number; dia: string } // dia: AAAA-MM-DD local
export interface BudgetRule { id: string; descripcion: string; categoria: string; montoTotal: number; frecuencia: Frecuencia; diaMes: number | null; proximaFecha: string; activo: boolean }
export interface BudgetLimit { categoria: BudgetCategory; montoMensual: number }

export function isMonth(value: string) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(value); }
export function monthOf(day: string) { return day.slice(0, 7); }
export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
}
const lastDay = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`;
};
const known = (categoria: string) => ((BUDGET_CATEGORIES as readonly string[]).includes(categoria) ? categoria : 'otro');

/** Occurrences of the active rules that fall in `month`, from `fromDay` on (today for the current month). */
export function upcomingInMonth(rules: BudgetRule[], month: string, fromDay: string) {
  const end = lastDay(month);
  const start = fromDay > `${month}-01` ? fromDay : `${month}-01`;
  const rows: { recurrenteId: string; descripcion: string; categoria: string; monto: number; dia: string }[] = [];
  for (const rule of rules) {
    if (!rule.activo) continue;
    let day = rule.proximaFecha;
    for (let guard = 0; day <= end && guard < 40; guard += 1) {
      if (day >= start) rows.push({ recurrenteId: rule.id, descripcion: rule.descripcion, categoria: known(rule.categoria), monto: rule.montoTotal, dia: day });
      day = nextOccurrence(day, rule.frecuencia, rule.diaMes);
    }
  }
  return rows.sort((a, b) => a.dia.localeCompare(b.dia) || a.descripcion.localeCompare(b.descripcion));
}

export function budgetSummary(input: { month: string; today: string; expenses: BudgetExpense[]; rules: BudgetRule[]; limits: BudgetLimit[] }) {
  const { month, today, expenses, rules, limits } = input;
  const inMonth = expenses.filter((e) => monthOf(e.dia) === month);
  // Past months have nothing left to come; future months count every occurrence.
  const proximos = month < monthOf(today) ? [] : upcomingInMonth(rules, month, month === monthOf(today) ? today : `${month}-01`);
  const limit = (categoria: BudgetCategory) => limits.find((l) => l.categoria === categoria)?.montoMensual ?? null;
  const line = (categoria: BudgetCategory, gastado: number, porVenir: number) => {
    const presupuesto = limit(categoria);
    const proyectado = gastado + porVenir;
    return {
      categoria, presupuesto, gastado, porVenir, proyectado,
      disponible: presupuesto === null ? null : presupuesto - proyectado,
      // ok < 80 % · cerca 80–100 % · pasado > 100 % (on the projected total, so a rent still to come counts).
      estado: presupuesto === null ? 'sin_presupuesto' as const : proyectado > presupuesto ? 'pasado' as const : proyectado >= presupuesto * 0.8 ? 'cerca' as const : 'ok' as const,
    };
  };
  const categorias = BUDGET_CATEGORIES.map((categoria) => line(
    categoria,
    inMonth.filter((e) => known(e.categoria) === categoria).reduce((sum, e) => sum + e.montoTotal, 0),
    proximos.filter((p) => p.categoria === categoria).reduce((sum, p) => sum + p.monto, 0),
  )).filter((c) => c.presupuesto !== null || c.gastado || c.porVenir);
  const total = line('total', inMonth.reduce((sum, e) => sum + e.montoTotal, 0), proximos.reduce((sum, p) => sum + p.monto, 0));
  return { mes: month, total, categorias, proximos, gastos: inMonth.length };
}
