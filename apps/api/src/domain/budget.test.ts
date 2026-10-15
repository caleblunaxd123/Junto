import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetSummary, shiftMonth, upcomingInMonth, isMonth } from './budget';

const rules = [
  { id: 'rent', descripcion: 'Alquiler', categoria: 'alojamiento', montoTotal: 150000, frecuencia: 'mensual' as const, diaMes: 15, proximaFecha: '2026-11-15', activo: true },
  { id: 'net', descripcion: 'Internet', categoria: 'otro', montoTotal: 12000, frecuencia: 'mensual' as const, diaMes: 20, proximaFecha: '2026-10-20', activo: true },
  { id: 'food', descripcion: 'Mercado', categoria: 'compras', montoTotal: 9000, frecuencia: 'semanal' as const, diaMes: null, proximaFecha: '2026-10-17', activo: true },
  { id: 'off', descripcion: 'Gimnasio', categoria: 'otro', montoTotal: 8000, frecuencia: 'mensual' as const, diaMes: 18, proximaFecha: '2026-10-18', activo: false },
];
const expenses = [
  { categoria: 'alojamiento', montoTotal: 150000, dia: '2026-10-15' },
  { categoria: 'comida', montoTotal: 6000, dia: '2026-10-03' },
  { categoria: 'comida', montoTotal: 4000, dia: '2026-09-28' }, // last month: not counted
  { categoria: 'viajes-raros', montoTotal: 1000, dia: '2026-10-10' }, // unknown category → otro
];

test('October: spent this month, what recurring expenses still add, state against the budget', () => {
  const s = budgetSummary({ month: '2026-10', today: '2026-10-15', expenses, rules, limits: [{ categoria: 'total', montoMensual: 200000 }, { categoria: 'compras', montoMensual: 30000 }, { categoria: 'comida', montoMensual: 50000 }] });
  // Internet on the 20th; groceries on the 17th, 24th and 31st; rent already passed (next is Nov 15); paused gym ignored.
  assert.deepEqual(s.proximos.map((p) => [p.dia, p.descripcion]), [['2026-10-17', 'Mercado'], ['2026-10-20', 'Internet'], ['2026-10-24', 'Mercado'], ['2026-10-31', 'Mercado']]);
  assert.deepEqual([s.total.gastado, s.total.porVenir, s.total.proyectado, s.total.disponible, s.total.estado], [157000, 39000, 196000, 4000, 'cerca']);
  const compras = s.categorias.find((c) => c.categoria === 'compras')!;
  assert.deepEqual([compras.gastado, compras.porVenir, compras.estado], [0, 27000, 'cerca']);
  const comida = s.categorias.find((c) => c.categoria === 'comida')!;
  assert.deepEqual([comida.gastado, comida.estado, comida.disponible], [6000, 'ok', 44000]);
  assert.equal(s.categorias.find((c) => c.categoria === 'otro')!.gastado, 1000);
  assert.equal(s.categorias.find((c) => c.categoria === 'transporte'), undefined, 'empty categories without a budget are omitted');
});

test('past months have nothing to come; next month counts every occurrence; over budget is flagged', () => {
  const past = budgetSummary({ month: '2026-09', today: '2026-10-15', expenses, rules, limits: [{ categoria: 'comida', montoMensual: 3000 }] });
  assert.equal(past.total.porVenir, 0);
  assert.equal(past.categorias.find((c) => c.categoria === 'comida')!.estado, 'pasado');
  const next = budgetSummary({ month: '2026-11', today: '2026-10-15', expenses, rules, limits: [] });
  assert.deepEqual(next.proximos.filter((p) => p.recurrenteId !== 'food').map((p) => p.dia), ['2026-11-15', '2026-11-20']);
  assert.equal(next.total.estado, 'sin_presupuesto');
});

test('months: shift across years, validation, occurrences from today', () => {
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.ok(isMonth('2026-10') && !isMonth('2026-13') && !isMonth('2026-1'));
  assert.deepEqual(upcomingInMonth(rules, '2026-10', '2026-10-25').map((p) => p.dia), ['2026-10-31']);
});

test('future budgets include weekly rules even more than forty occurrences ahead', () => {
  const upcoming = upcomingInMonth([rules[2]], '2030-10', '2030-10-01');
  assert.ok(upcoming.length >= 4);
  assert.ok(upcoming.every(row => row.dia.startsWith('2030-10')));
  assert.equal((new Date(`${upcoming[0].dia}T00:00:00Z`).getTime() - new Date('2026-10-17T00:00:00Z').getTime()) % (7 * 86_400_000), 0);
});
