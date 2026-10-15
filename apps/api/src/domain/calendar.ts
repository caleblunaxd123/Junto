/** The UTC instant at the start of a calendar day in an IANA zone (including DST). */
export function startOfCalendarDay(day: string, timeZone: string) {
  const target = new Date(`${day}T00:00:00Z`).getTime();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p => [p.type, p.value]));
    const represented = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    const adjustment = target - represented;
    if (!adjustment) break;
    instant += adjustment;
  }
  return new Date(instant);
}
export function followingCalendarDay(day: string) { return new Date(new Date(`${day}T00:00:00Z`).getTime() + 86400000).toISOString().slice(0, 10); }
