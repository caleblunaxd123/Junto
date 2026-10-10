/** "500", "500.5", "500,50" or "S/ 1 200" → cents; null when it is not a usable amount. */
export function parseAmount(text: string): number | null {
  let value = text.replace(/s\/|\s/gi, "");
  if (/^\d+,\d{1,2}$/.test(value)) value = value.replace(",", ".");
  value = value.replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents > 0 && cents <= 999_999_999 ? cents : null;
}

/** What one person pays when `total` is split in `parts` (the first parts carry the extra cent). */
export function partAmount(total: number, parts: number) {
  return Math.ceil(total / parts);
}

/** End of that day, local time: "vence el sábado" means the whole Saturday. */
export function endOfDay(date: Date) {
  const end = new Date(date);
  end.setHours(23, 59, 0, 0);
  return end;
}

export function addDays(days: number, from = new Date()) {
  const date = new Date(from);
  date.setDate(date.getDate() + days);
  return endOfDay(date);
}

export function deadlineText(iso: string, now = new Date()) {
  const deadline = new Date(iso);
  const when = deadline.toLocaleDateString("es-PE", { weekday: "long", day: "numeric", month: "long" });
  const days = Math.ceil((endOfDay(deadline).getTime() - endOfDay(now).getTime()) / 86_400_000);
  if (deadline.getTime() < now.getTime()) {
    const late = Math.max(0, -days);
    return { text: late ? `Venció hace ${late} ${late === 1 ? "día" : "días"}` : "Venció hoy", late: true, when };
  }
  return { text: days === 0 ? "Vence hoy" : days === 1 ? "Vence mañana" : `Vence en ${days} días`, late: false, when };
}
