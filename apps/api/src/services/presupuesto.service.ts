import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { UserError } from '../domain/errors';
import { BUDGET_CATEGORIES, budgetSummary, isMonth, monthOf, shiftMonth, type BudgetCategory } from '../domain/budget';
import { calendarToday, type Frecuencia } from '../domain/recurrence';
import { groupEvent, requireOpenGroup } from './groupLifecycle.service';
import { formatMoney } from '@junto/shared/currency';

const categorias = ['total', ...BUDGET_CATEGORIES] as [BudgetCategory, ...BudgetCategory[]];
// null removes that line of the budget.
export const presupuestoSchema = z.object({
  categoria: z.enum(categorias),
  montoMensual: z.number().int().positive('El presupuesto debe ser mayor que cero.').max(999_999_999).nullable(),
}).strict();
export const mesSchema = z.string().refine(isMonth, 'Mes inválido (AAAA-MM).').optional();

const labels: Record<BudgetCategory, string> = { total: 'todo el grupo', alojamiento: 'Vivienda', comida: 'Comida', compras: 'Compras', transporte: 'Transporte', entretenimiento: 'Diversión', otro: 'Servicios y otros' };
// Calendar day of an expense in Lima (expenses are instants; months are local).
const limaDay = (date: Date) => calendarToday('America/Lima', date);
const limaMonthStart = (month: string) => new Date(`${month}-01T05:00:00.000Z`); // 00:00 in Lima (UTC-5, no DST)

async function member(grupoId: string, userId: string) {
  const row = await prisma.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { grupo: { select: { nombre: true, moneda: true, tipo: true, estado: true } } } });
  if (!row) throw new UserError('No perteneces a este grupo', 403);
  return row.grupo;
}

/** The month at a glance: spent, still to come from recurring expenses, and the budget per category. */
export async function presupuestoDelMes(grupoId: string, userId: string, mes?: string) {
  const grupo = await member(grupoId, userId);
  const today = calendarToday();
  const month = mes ?? monthOf(today);
  const [expenses, rules, limits] = await prisma.$transaction([
    // A day of margin on each side; the exact month is decided with the Lima calendar day.
    prisma.gasto.findMany({ where: { grupoId, activo: true, fecha: { gte: new Date(limaMonthStart(month).getTime() - 86_400_000), lt: new Date(limaMonthStart(shiftMonth(month, 1)).getTime() + 86_400_000) } }, select: { categoria: true, montoTotal: true, fecha: true } }),
    prisma.gastoRecurrente.findMany({ where: { grupoId, activo: true }, select: { id: true, descripcion: true, categoria: true, montoTotal: true, frecuencia: true, diaMes: true, proximaFecha: true, activo: true } }),
    prisma.presupuestoGrupo.findMany({ where: { grupoId }, select: { categoria: true, montoMensual: true } }),
  ], { isolationLevel: 'RepeatableRead' });
  const summary = budgetSummary({
    month, today,
    expenses: expenses.map((e) => ({ categoria: e.categoria, montoTotal: e.montoTotal, dia: limaDay(e.fecha) })),
    rules: grupo.estado !== 'abierto' ? [] : rules.map((r) => ({ ...r, frecuencia: r.frecuencia as Frecuencia, proximaFecha: r.proximaFecha.toISOString().slice(0, 10) })),
    limits: limits.map((l) => ({ categoria: l.categoria as BudgetCategory, montoMensual: l.montoMensual })),
  });
  return { grupo: { nombre: grupo.nombre, moneda: grupo.moneda, estado: grupo.estado }, hoy: today, mesActual: monthOf(today), ...summary };
}

/** Sets or removes one line of the budget. Any member may; it is recorded in the group history. */
export async function fijarPresupuesto(grupoId: string, input: z.infer<typeof presupuestoSchema>, userId: string) {
  const grupo = await member(grupoId, userId);
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    const active = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } } });
    if (!active) throw new UserError('No perteneces a este grupo', 403);
    await requireOpenGroup(tx, grupoId);
    if (input.montoMensual === null) {
      const removed = await tx.presupuestoGrupo.deleteMany({ where: { grupoId, categoria: input.categoria } });
      if (removed.count) await groupEvent(tx, grupoId, userId, 'presupuesto_quitado', `Se quitó el presupuesto de ${labels[input.categoria]}.`, { categoria: input.categoria });
      return;
    }
    await tx.presupuestoGrupo.upsert({
      where: { grupoId_categoria: { grupoId, categoria: input.categoria } },
      create: { grupoId, categoria: input.categoria, montoMensual: input.montoMensual, actualizadoPor: userId },
      update: { montoMensual: input.montoMensual, actualizadoPor: userId },
    });
    await groupEvent(tx, grupoId, userId, 'presupuesto_fijado', `Presupuesto de ${labels[input.categoria]}: ${formatMoney(input.montoMensual, grupo.moneda)} al mes.`, { categoria: input.categoria, montoMensual: input.montoMensual });
  });
  return presupuestoDelMes(grupoId, userId);
}
