import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { UserError } from '../domain/errors';
import { describeError } from '../lib/logSafe';
import { crearGastoSchema, type CrearGastoInput } from '../schemas/gastos.schema';
import { calendarToday, describeFrequency, dueOccurrences, FRECUENCIAS, isCalendarDay, nextOccurrence, occurrenceOnOrAfter, type Frecuencia } from '../domain/recurrence';
import { calcularParticipantes, crearGasto, validarMiembros } from './gastos.service';
import { groupEvent, requireOpenGroup } from './groupLifecycle.service';

export const crearRecurrenteSchema = crearGastoSchema.omit({ fecha: true, partes: true }).extend({
  frecuencia: z.enum(FRECUENCIAS as [Frecuencia, ...Frecuencia[]]),
  // The first time it is added (today or later). Monthly rules repeat on that day of the month.
  primeraFecha: z.string().refine(isCalendarDay, 'Elige una fecha válida.'),
  solicitudId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/, 'Identificador de envío inválido.').optional(),
}).strict();
export const actualizarRecurrenteSchema = z.object({ activo: z.boolean() }).strict();
type CrearRecurrenteInput = z.infer<typeof crearRecurrenteSchema>;

const day = (date: Date) => date.toISOString().slice(0, 10);
// An occurrence is dated at noon in Lima, so it shows on its calendar day in every Peruvian phone.
const noonInLima = (calendarDay: string) => `${calendarDay}T17:00:00.000Z`;
const template = (rule: { descripcion: string; categoria: string; montoTotal: number; pagadoPor: string; tipoDivision: string; participantes: Prisma.JsonValue; notas: string | null }): Omit<CrearGastoInput, 'solicitudId'> => ({
  descripcion: rule.descripcion,
  categoria: rule.categoria as CrearGastoInput['categoria'],
  montoTotal: rule.montoTotal,
  pagadoPor: rule.pagadoPor,
  tipoDivision: rule.tipoDivision as CrearGastoInput['tipoDivision'],
  participantes: rule.participantes as CrearGastoInput['participantes'],
  notas: rule.notas ?? undefined,
});

async function member(grupoId: string, usuarioId: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.grupoMiembro.findFirst({ where: { grupoId, usuarioId, activo: true, grupo: { activo: true } }, select: { rol: true } });
  if (!row) throw new UserError('No perteneces a este grupo', 403);
  return row;
}

/** Programs a recurring expense. If its first day is today (or earlier), the first one is added now. */
export async function crearRecurrente(grupoId: string, input: CrearRecurrenteInput, userId: string) {
  if (input.pagadores) throw new UserError('Los gastos con varios pagadores se guardan como gastos normales, sin repetición automática.');
  await member(grupoId, userId);
  const today = calendarToday();
  // Same split rules as a manual expense: an invalid template is rejected now, not every month.
  calcularParticipantes({ ...input, solicitudId: undefined });
  const { solicitudId: _request, ...content } = input;
  const huella = createHash('sha256').update(JSON.stringify({ grupoId, ...content })).digest('hex');
  const rule = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    await member(grupoId, userId, tx);
    if (input.solicitudId) {
      const previous = await tx.gastoRecurrente.findUnique({ where: { creadoPor_solicitudId: { creadoPor: userId, solicitudId: input.solicitudId } } });
      if (previous) {
        const event = previous.grupoId === grupoId ? await tx.eventoGrupo.findFirst({ where: { grupoId, tipo: 'recurrente_creado', detalle: { path: ['recurrenteId'], equals: previous.id } }, select: { detalle: true } }) : null;
        if (!event || (event.detalle as { huella?: string }).huella !== huella) throw new UserError('Este envío ya programó otro gasto. Revisa los gastos que se repiten antes de guardar.', 409);
        return previous;
      }
    }
    await requireOpenGroup(tx, grupoId);
    if (input.primeraFecha < today) throw new UserError('La primera fecha no puede ser pasada. Anota los gastos anteriores como gastos normales.', 400);
    await validarMiembros(grupoId, input.pagadoPor, input.participantes.map((p) => p.usuarioId), tx);
    const created = await tx.gastoRecurrente.create({ data: {
      grupoId, creadoPor: userId, descripcion: input.descripcion, categoria: input.categoria, montoTotal: input.montoTotal,
      pagadoPor: input.pagadoPor, tipoDivision: input.tipoDivision, participantes: input.participantes as Prisma.InputJsonValue,
      notas: input.notas, frecuencia: input.frecuencia, diaMes: input.frecuencia === 'mensual' ? Number(input.primeraFecha.slice(8, 10)) : null,
      proximaFecha: new Date(`${input.primeraFecha}T00:00:00Z`), solicitudId: input.solicitudId,
    } });
    await groupEvent(tx, grupoId, userId, 'recurrente_creado', `Se programó «${input.descripcion}» ${describeFrequency(input.frecuencia, created.diaMes)}.`, { recurrenteId: created.id, huella });
    return created;
  });
  await runRule(rule.id, today);
  return detalle(rule.id);
}

async function detalle(id: string) {
  const rule = await prisma.gastoRecurrente.findUniqueOrThrow({ where: { id }, include: { creador: { select: { id: true, nombre: true } }, _count: { select: { gastos: true } } } });
  const pagador = await prisma.usuario.findUnique({ where: { id: rule.pagadoPor }, select: { id: true, nombre: true } });
  return {
    id: rule.id, grupoId: rule.grupoId, descripcion: rule.descripcion, categoria: rule.categoria, montoTotal: rule.montoTotal,
    pagador, tipoDivision: rule.tipoDivision, participantes: rule.participantes, frecuencia: rule.frecuencia, diaMes: rule.diaMes,
    cada: describeFrequency(rule.frecuencia as Frecuencia, rule.diaMes), proximaFecha: day(rule.proximaFecha), activo: rule.activo,
    pausaMotivo: rule.pausaMotivo, creador: rule.creador, gastosCreados: rule._count.gastos,
  };
}

export async function listarRecurrentes(grupoId: string, userId: string) {
  await member(grupoId, userId);
  const rules = await prisma.gastoRecurrente.findMany({ where: { grupoId }, orderBy: [{ activo: 'desc' }, { proximaFecha: 'asc' }], select: { id: true } });
  return Promise.all(rules.map((rule) => detalle(rule.id)));
}

async function ownRule(tx: Prisma.TransactionClient, grupoId: string, id: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
  const rule = await tx.gastoRecurrente.findUnique({ where: { id } });
  if (!rule || rule.grupoId !== grupoId) throw new UserError('No encontramos este gasto que se repite.', 404);
  const { rol } = await member(grupoId, userId, tx);
  if (rule.creadoPor !== userId && rol !== 'admin') throw new UserError('Solo quien lo programó o un administrador puede cambiarlo.', 403);
  return rule;
}

/** Pause or resume. Resuming never back-fills: it continues from today. */
export async function actualizarRecurrente(grupoId: string, id: string, input: z.infer<typeof actualizarRecurrenteSchema>, userId: string) {
  const today = calendarToday();
  await prisma.$transaction(async (tx) => {
    const rule = await ownRule(tx, grupoId, id, userId);
    if (input.activo) await requireOpenGroup(tx, grupoId);
    const proxima = input.activo && !rule.activo ? occurrenceOnOrAfter(day(rule.proximaFecha), today, rule.frecuencia as Frecuencia, rule.diaMes) : day(rule.proximaFecha);
    await tx.gastoRecurrente.update({ where: { id }, data: { activo: input.activo, pausaMotivo: null, proximaFecha: new Date(`${proxima}T00:00:00Z`) } });
    await groupEvent(tx, rule.grupoId, userId, input.activo ? 'recurrente_reanudado' : 'recurrente_pausado', `${input.activo ? 'Se reanudó' : 'Se pausó'} «${rule.descripcion}».`, { recurrenteId: id });
  });
  if (input.activo) await runRule(id, today);
  return detalle(id);
}

/** Stops it for good. Expenses it already added stay as normal expenses. */
export async function eliminarRecurrente(grupoId: string, id: string, userId: string) {
  await prisma.$transaction(async (tx) => {
    const rule = await ownRule(tx, grupoId, id, userId);
    await tx.gastoRecurrente.delete({ where: { id } });
    await groupEvent(tx, rule.grupoId, userId, 'recurrente_eliminado', `«${rule.descripcion}» dejó de repetirse. Los gastos ya anotados siguen igual.`);
  });
}

/**
 * Adds every occurrence that is due. Safe to run twice or from two servers at once: each occurrence
 * uses a request id derived from the rule and the day, so it is created once; the next date only
 * moves forward from the value this run read. A rule that can no longer add its expense (someone
 * left, the group closed) pauses itself and says why.
 */
export async function runRule(id: string, today = calendarToday()) {
  const rule = await prisma.gastoRecurrente.findUnique({ where: { id } });
  if (!rule || !rule.activo) return 0;
  const from = day(rule.proximaFecha);
  const { due } = dueOccurrences(from, today, rule.frecuencia as Frecuencia, rule.diaMes);
  let created = 0;
  for (const occurrence of due) {
    try {
      const result = await crearGasto(rule.grupoId, { ...template(rule), fecha: noonInLima(occurrence), solicitudId: `rec-${rule.id}-${occurrence.replace(/-/g, '')}` }, rule.creadoPor, { recurrenteId: rule.id, occurrence, next: nextOccurrence(occurrence, rule.frecuencia as Frecuencia, rule.diaMes) });
      if (!result.repetido) created += 1;
    } catch (error) {
      if (!(error instanceof UserError)) throw error;
      if (error.code === 'RECURRENCE_CHANGED') return created;
      await prisma.gastoRecurrente.updateMany({ where: { id, activo: true, proximaFecha: new Date(`${occurrence}T00:00:00Z`) }, data: { activo: false, pausaMotivo: error.message.slice(0, 200) } });
      return created;
    }
  }
  return created;
}

/** The daily job: every active rule with something due. */
export async function generarRecurrentes(today = calendarToday()) {
  const rules = await prisma.gastoRecurrente.findMany({ where: { activo: true, proximaFecha: { lte: new Date(`${today}T00:00:00Z`) } }, select: { id: true }, take: 500 });
  let created = 0;
  for (const rule of rules) {
    try { created += await runRule(rule.id, today); }
    catch (error) { console.error('[Recurrentes] Rule failed:', rule.id, describeError(error)); }
  }
  return { reglas: rules.length, creados: created };
}
