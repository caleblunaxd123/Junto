const HOUR = 3_600_000;
const DAY = 24 * HOUR;
export const OVERDUE_REMINDER_DAYS = 14;

/**
 * Which deadline reminder is due now, or null. Each stage is sent once per person: 3 days before,
 * the last 24 hours, the day it passes, then every 2 days while overdue (up to two weeks).
 * Windows are wide on purpose: an hourly job that skips an hour (or quiet hours) still lands in one.
 */
export function deadlineStage(now: Date, deadline: Date): string | null {
  const left = deadline.getTime() - now.getTime();
  if (left > 3 * DAY) return null;
  if (left > DAY) return "limite-d3";
  if (left > 0) return "limite-d1";
  const overdueDays = Math.floor(-left / DAY);
  if (overdueDays === 0) return "limite-d0";
  if (overdueDays > OVERDUE_REMINDER_DAYS || overdueDays % 2) return null;
  return `limite-v${overdueDays}`;
}

/** Nobody gets a money reminder at night: only 8:00–20:59 in Lima (UTC−5, no daylight saving). */
export function isQuietHour(now: Date) {
  const limaHour = (now.getUTCHours() + 24 - 5) % 24;
  return limaHour < 8 || limaHour >= 21;
}

const fmt = (date: Date) => date.toLocaleString("es-PE", { timeZone: "America/Lima", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export function deadlineMessage(stage: string, cents: number, groupName: string, deadline: Date, division: boolean) {
  const owed = `te falta ${division ? "aportar" : "pagar"} S/ ${(cents / 100).toFixed(2)}`;
  if (stage === "limite-d3") return `Quedan menos de 3 días (vence ${fmt(deadline)}): ${owed} en «${groupName}».`;
  if (stage === "limite-d1") return `Vence en menos de 24 horas (${fmt(deadline)}): ${owed} en «${groupName}».`;
  if (stage === "limite-d0") return `Hoy venció el plazo de «${groupName}»: ${owed}.`;
  return `El plazo de «${groupName}» venció hace ${stage.replace("limite-v", "")} días: ${owed}.`;
}
