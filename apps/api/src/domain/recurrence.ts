/**
 * Recurring expenses (rent, internet, utilities). Dates are calendar days (AAAA-MM-DD) in the group's
 * local time; amounts are not recalculated here. Monthly rules remember the day of the month, so a
 * rule for the 31st lands on the last day of shorter months and goes back to the 31st afterwards.
 */
export type Frecuencia = 'semanal' | 'quincenal' | 'mensual';
export const FRECUENCIAS: readonly Frecuencia[] = ['semanal', 'quincenal', 'mensual'];

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function isCalendarDay(value: string) {
  if (!DAY.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const addDays = (day: string, days: number) => new Date(new Date(`${day}T00:00:00Z`).getTime() + days * 86_400_000).toISOString().slice(0, 10);
const lastDayOfMonth = (year: number, month0: number) => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

/** The occurrence after `day`. `diaMes` (1–31) keeps monthly rules on their intended day. */
export function nextOccurrence(day: string, frecuencia: Frecuencia, diaMes?: number | null) {
  if (!isCalendarDay(day)) throw new Error('Fecha inválida');
  if (frecuencia === 'semanal') return addDays(day, 7);
  if (frecuencia === 'quincenal') return addDays(day, 15);
  const [year, month] = day.split('-').map(Number);
  const target = diaMes ?? Number(day.slice(8, 10));
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth0 = month === 12 ? 0 : month; // month is 1-based, so this is the following month
  const dayOfMonth = Math.min(target, lastDayOfMonth(nextYear, nextMonth0));
  return `${nextYear}-${String(nextMonth0 + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
}

/** Seek without walking years of missed weekly occurrences (budget previews and resume). */
export function occurrenceOnOrAfter(day: string, target: string, frecuencia: Frecuencia, diaMes?: number | null) {
  if (day >= target) return day;
  if (frecuencia !== 'mensual') {
    const step = frecuencia === 'semanal' ? 7 : 15;
    const days = (new Date(`${target}T00:00:00Z`).getTime() - new Date(`${day}T00:00:00Z`).getTime()) / 86_400_000;
    return addDays(day, Math.ceil(days / step) * step);
  }
  const [year, month] = target.split('-').map(Number);
  const intended = diaMes ?? Number(day.slice(8, 10));
  const candidate = `${target.slice(0, 7)}-${String(Math.min(intended, lastDayOfMonth(year, month - 1))).padStart(2, '0')}`;
  return candidate >= target ? candidate : nextOccurrence(candidate, frecuencia, intended);
}

/** Every occurrence due up to `today` (inclusive), at most `limit`, and the next pending one. */
export function dueOccurrences(proximaFecha: string, today: string, frecuencia: Frecuencia, diaMes?: number | null, limit = 6) {
  const due: string[] = [];
  let next = proximaFecha;
  while (next <= today && due.length < limit) {
    due.push(next);
    next = nextOccurrence(next, frecuencia, diaMes);
  }
  return { due, next };
}

/** Today's calendar day in a time zone (Peru by default). */
export function calendarToday(timeZone = 'America/Lima', now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function describeFrequency(frecuencia: Frecuencia, diaMes?: number | null) {
  if (frecuencia === 'semanal') return 'cada semana';
  if (frecuencia === 'quincenal') return 'cada 15 días';
  return diaMes ? `cada mes, el día ${diaMes}` : 'cada mes';
}
