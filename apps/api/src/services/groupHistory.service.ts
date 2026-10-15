import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { UserError } from '../domain/errors';
import { startOfCalendarDay, followingCalendarDay } from '../domain/calendar';

const calendarDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}, 'Escribe una fecha válida.');
export const historyQuery = z.object({
  buscar: z.string().trim().max(100).default(''),
  desde: calendarDate.optional(), hasta: calendarDate.optional(),
  tipo: z.enum(['todos', 'gastos', 'pagos', 'cambios']).default('todos'),
  cursor: z.string().max(500).optional(),
  zona: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat('es', { timeZone: value }); return true; } catch { return false; } }, 'Zona horaria inválida.').default('America/Lima'),
}).refine(q => !q.desde || !q.hasta || q.desde <= q.hasta, 'La fecha inicial debe ser anterior a la final.');
type Query = z.infer<typeof historyQuery>;
type Cursor = { fecha: string; clave: string };
function readCursor(value?: string): Cursor | undefined {
  if (!value) return;
  try {
    return z.object({ fecha: z.string().datetime(), clave: z.string().regex(/^(gasto|pago|evento)-[a-f0-9-]{36}$/) }).strict().parse(JSON.parse(Buffer.from(value, 'base64url').toString()));
  } catch { throw new UserError('La página ya no es válida. Actualiza los movimientos.', 400); }
}

/** Search all stored movements, not only the last chat page. Keyset pagination keeps ties stable. */
export async function groupHistory(userId: string, grupoId: string, query: Query) {
  return prisma.$transaction(async tx => {
    if (!await tx.grupoMiembro.count({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } } })) throw new UserError('No perteneces a este grupo.', 403);
    const cursor = readCursor(query.cursor);
    const afterCursor = (prefix: string, field: string) => {
      if (!cursor) return {};
      const date = new Date(cursor.fecha);
      const boundary = cursor.clave.split('-')[0];
      return prefix < boundary ? { [field]: { lte: date } } : prefix > boundary ? { [field]: { lt: date } }
        : { OR: [{ [field]: { lt: date } }, { [field]: date, id: { lt: cursor.clave.slice(prefix.length + 1) } }] };
    };
    const calendarDates = query.desde || query.hasta ? {
      ...(query.desde ? { gte: new Date(`${query.desde}T00:00:00Z`) } : {}),
      ...(query.hasta ? { lt: new Date(`${followingCalendarDay(query.hasta)}T00:00:00Z`) } : {}),
    } : undefined;
    const dates = query.desde || query.hasta ? {
      ...(query.desde ? { gte: startOfCalendarDay(query.desde, query.zona) } : {}),
      ...(query.hasta ? { lt: startOfCalendarDay(followingCalendarDay(query.hasta), query.zona) } : {}),
    } : undefined;
    const contains = { contains: query.buscar, mode: 'insensitive' as const };
    const person = { select: { id: true, nombre: true } } as const;
    const [expenses, payments, events] = await Promise.all([
      query.tipo === 'todos' || query.tipo === 'gastos' ? tx.gasto.findMany({
        where: { grupoId, activo: true, AND: [afterCursor('gasto', 'fechaRegistro') as Prisma.GastoWhereInput,
          ...(dates ? [{ fecha: dates }] : []),
          ...(query.buscar ? [{ OR: [{ descripcion: contains }, { notas: contains }, { pagador: { nombre: contains } }, { participantes: { some: { usuario: { nombre: contains } } } }] }] : [])] },
        include: { pagador: person }, orderBy: [{ fechaRegistro: 'desc' }, { id: 'desc' }], take: 31,
      }) : [],
      query.tipo === 'todos' || query.tipo === 'pagos' ? tx.pago.findMany({
        where: { grupoId, AND: [afterCursor('pago', 'fechaPago') as Prisma.PagoWhereInput,
          ...(dates ? [{ OR: [{ fechaEfectiva: calendarDates }, { fechaEfectiva: null, fechaPago: dates }] }] : []),
          ...(query.buscar ? [{ OR: [{ nota: contains }, { metodo: contains }, { pagador: { nombre: contains } }, { receptor: { nombre: contains } }] }] : [])] },
        include: { pagador: person, receptor: person, comprobante: { select: { id: true } } }, orderBy: [{ fechaPago: 'desc' }, { id: 'desc' }], take: 31,
      }) : [],
      query.tipo === 'todos' || query.tipo === 'cambios' ? tx.eventoGrupo.findMany({
        where: { grupoId, AND: [afterCursor('evento', 'fecha') as Prisma.EventoGrupoWhereInput,
          ...(dates ? [{ fecha: dates }] : []),
          ...(query.buscar ? [{ OR: [{ texto: contains }, { autor: { nombre: contains } }] }] : [])] },
        include: { autor: person }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: 31,
      }) : [],
    ]);
    const rows = [
      ...expenses.map(e => ({ clave: `gasto-${e.id}`, tipo: 'gasto', id: e.id, fechaRegistro: e.fechaRegistro.toISOString(), fecha: e.fecha.toISOString(), titulo: e.descripcion, texto: `Pagó ${e.pagador.nombre}`, monto: e.montoTotal, estado: 'vigente', detalle: null as unknown })),
      ...payments.map(p => ({ clave: `pago-${p.id}`, tipo: 'pago', id: p.id, fechaRegistro: p.fechaPago.toISOString(), fecha: p.fechaEfectiva ? p.fechaEfectiva.toISOString().slice(0, 10) : p.fechaPago.toISOString(), titulo: `${p.pagador.nombre} → ${p.receptor.nombre}`, texto: p.metodo ?? 'Pago', monto: p.monto, estado: p.estado, detalle: null as unknown })),
      ...events.map(e => ({ clave: `evento-${e.id}`, tipo: 'cambio', id: e.id, fechaRegistro: e.fecha.toISOString(), fecha: e.fecha.toISOString(), titulo: e.texto, texto: e.autor.nombre, monto: null, estado: e.tipo, detalle: e.detalle as unknown })),
    ].sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro) || (a.clave < b.clave ? 1 : a.clave > b.clave ? -1 : 0));
    const movimientos = rows.slice(0, 30);
    const last = movimientos.at(-1);
    return { movimientos, siguiente: rows.length > 30 && last ? Buffer.from(JSON.stringify({ fecha: last.fechaRegistro, clave: last.clave })).toString('base64url') : null };
  }, { isolationLevel: 'RepeatableRead' });
}
