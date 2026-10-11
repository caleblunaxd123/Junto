import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { UserError } from '../domain/errors';
import { createRateReader } from '../domain/exchange';

const read = createRateReader();
const cache = new Map<string, { until: number; value: Awaited<ReturnType<typeof fetchReference>> }>();
const inFlight = new Map<string, Promise<Awaited<ReturnType<typeof fetchReference>>>>();
async function fetchReference(origen: string, destino: string, fecha: string) {
  const rate = await read(origen, destino, fecha);
  const clave = createHash('sha256').update(JSON.stringify(rate)).digest('hex');
  return prisma.cotizacionCambio.upsert({ where: { clave }, update: {}, create: { ...rate, clave, fecha: new Date(`${rate.fecha}T00:00:00Z`) } });
}
export async function paymentReference(userId: string, grupoId: string, origen: string, fecha: string) {
  const member = await prisma.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { grupo: { select: { moneda: true } } } });
  if (!member) throw new UserError('No perteneces a este grupo.', 403);
  const destino = member.grupo.moneda;
  if (origen === destino) throw new UserError('Elige otra moneda para consultar el cambio.');
  const key = `${origen}:${destino}:${fecha}`;
  const saved = cache.get(key);
  if (saved && saved.until > Date.now()) return saved.value;
  if (inFlight.has(key)) return inFlight.get(key)!;
  if (inFlight.size >= 4) throw new UserError('Hay varias consultas en curso. Reintenta o escribe el cambio acordado.', 503);
  const pending = fetchReference(origen, destino, fecha).then((value) => {
    if (cache.size >= 256) cache.delete(cache.keys().next().value!);
    cache.set(key, { until: Date.now() + 3600000, value });
    return value;
  }).catch(() => { throw new UserError('No pudimos consultar una referencia fiable para esa fecha. Puedes escribir el cambio que acordaron.', 503); }).finally(() => inFlight.delete(key));
  inFlight.set(key, pending);
  return pending;
}
