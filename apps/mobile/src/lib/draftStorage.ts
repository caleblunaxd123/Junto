import { z } from "zod";
// Every operation on a key is serialized, including deletion and subsequent reads.
const queues = new Map<string, Promise<unknown>>();
export function draftOperation<T>(key: string, action: () => Promise<T>): Promise<T> {
  const next = (queues.get(key) || Promise.resolve()).catch(() => undefined).then(action);
  queues.set(key, next);
  void next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => undefined);
  return next;
}
const short = z.string().max(80);
const snapshot = z.object({
  id: short, nombre: z.string().max(100), tipo: z.enum(["viaje", "roomies", "pareja", "amigos", "trabajo", "deporte", "otro"]),
  moneda: z.enum(["PEN", "USD", "EUR", "COP", "MXN", "BRL"]),
  // No email, phone, invitation code, balance, avatar URL or payment history in this cache.
  miembros: z.array(z.object({ usuarioId: short, usuario: z.object({ id: short, nombre: z.string().max(100), fotoUrl: z.undefined().optional() }) }).strict()).max(50),
}).strict();
export const expenseDraftSchema = z.object({
  amount: z.string().max(16), description: z.string().max(200), payer: short,
  ids: z.array(short).max(50), mode: z.enum(["igual", "exacto", "porcentaje", "participaciones"]), values: z.record(z.string().max(80), z.string().max(16)),
  category: z.enum(["comida", "transporte", "entretenimiento", "alojamiento", "compras", "otro"]), categoryPicked: z.boolean(),
  text: z.string().max(500), notes: z.string().max(500), date: z.string().datetime(), requestId: short,
  group: snapshot.optional(), savedAt: z.string().datetime(),
  // Frozen payload before a request with an uncertain outcome: never silently edit/re-send it.
  pending: z.object({ descripcion: z.string().max(200), montoTotal: z.number().int().positive().max(999_999_999), pagadoPor: short, categoria: z.string().max(40), tipoDivision: z.enum(["igual", "exacto", "porcentaje", "participaciones"]), fecha: z.string().datetime(), notas: z.string().max(500).optional(), solicitudId: short, participantes: z.array(z.object({ usuarioId: short, monto: z.number().int().nonnegative().optional(), porcentaje: z.number().min(0).max(100).optional(), participaciones: z.number().int().min(0).max(1000).optional() }).strict()).min(1).max(50) }).strict().optional(),
}).strict();
export type ExpenseDraft = z.infer<typeof expenseDraftSchema>;
export const expenseDraftPrefix = (userId: string) => `junto.expenseDraft.v1.${userId}.`;
export const expenseDraftKey = (userId: string, groupId: string) => `${expenseDraftPrefix(userId)}${groupId}`;
