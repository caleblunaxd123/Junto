import { formatMoney } from '@junto/shared/currency';
import { dayLabel } from './statement';

export type HistoryEntry = { clave: string; tipo: 'gasto' | 'pago' | 'cambio'; id: string; fecha: string; fechaRegistro: string; titulo: string; texto: string; monto: number | null; estado: string; detalle: unknown };
export type HistoryPage = { movimientos: HistoryEntry[]; siguiente: string | null };
export function historyStatus(entry: HistoryEntry) {
  return entry.tipo !== 'pago' ? '' : entry.estado === 'exitoso' ? 'Confirmado' : entry.estado === 'reportado' ? 'Por confirmar · aún no cuenta' : entry.estado === 'rechazado' ? 'Rechazado · no cuenta' : 'No confirmado · no cuenta';
}
type Snapshot = { descripcion?: string; montoTotal?: number; pagadoPor?: string; categoria?: string; fecha?: string; notas?: string | null; partes?: number | null; participantes?: { usuarioId: string; montoAsignado: number }[] };
export function historyChangeLines(detail: unknown, moneda: string, names: Map<string, string>) {
  if (!detail || typeof detail !== 'object') return [];
  const d = detail as { antes?: Snapshot; despues?: Snapshot };
  const before = d.antes, after = d.despues;
  if (!before || !after) return [];
  const money = (v?: number) => formatMoney(v ?? 0, moneda);
  const person = (id?: string) => id ? names.get(id) ?? 'Persona del historial' : '—';
  const lines: string[] = [];
  if (before.descripcion !== after.descripcion) lines.push(`Concepto: ${before.descripcion} → ${after.descripcion}`);
  if (before.montoTotal !== after.montoTotal) lines.push(`Monto: ${money(before.montoTotal)} → ${money(after.montoTotal)}`);
  if (before.pagadoPor !== after.pagadoPor) lines.push(`Pagó: ${person(before.pagadoPor)} → ${person(after.pagadoPor)}`);
  if (before.fecha !== after.fecha && before.fecha && after.fecha) lines.push(`Fecha: ${dayLabel(before.fecha)} → ${dayLabel(after.fecha)}`);
  if (before.categoria !== after.categoria) lines.push(`Categoría: ${before.categoria} → ${after.categoria}`);
  if (before.notas !== after.notas) lines.push(`Nota: ${before.notas || 'sin nota'} → ${after.notas || 'sin nota'}`);
  if (before.partes !== after.partes) lines.push(`Partes abiertas: ${before.partes ?? 'sin partes abiertas'} → ${after.partes ?? 'sin partes abiertas'}`);
  const previous = new Map((before.participantes ?? []).map(p => [p.usuarioId, p.montoAsignado]));
  const next = new Map((after.participantes ?? []).map(p => [p.usuarioId, p.montoAsignado]));
  for (const id of new Set([...previous.keys(), ...next.keys()])) {
    if (previous.get(id) !== next.get(id)) lines.push(`Parte de ${person(id)}: ${money(previous.get(id))} → ${money(next.get(id))}`);
  }
  return lines;
}
