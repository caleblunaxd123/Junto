export type ContributionMode = "ahora" | "corregir";

const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;

/**
 * The server stores the cumulative amount confirmed per person (with a version check), so a retry
 * never adds twice. People think in "what I received now", so that is what we ask, and we compute
 * the cumulative total here. "Corregir" sets the total directly, for mistakes.
 */
export function nextContribution(mode: ContributionMode, confirmed: number, share: number, entered: number | null): { total: number | null; error: string } {
  if (!Number.isSafeInteger(confirmed) || !Number.isSafeInteger(share) || confirmed < 0 || share < 0 || confirmed > share)
    return { total: null, error: "Actualiza la cuenta antes de registrar el aporte." };
  if (entered === null || !Number.isSafeInteger(entered) || entered < 0)
    return { total: null, error: "Escribe un monto en soles, con hasta 2 decimales." };
  if (mode === "ahora") {
    if (entered === 0) return { total: null, error: "Escribe cuánto recibiste ahora." };
    if (confirmed + entered > share)
      return { total: null, error: `Supera su parte: solo le falta ${money(share - confirmed)}.` };
    return { total: confirmed + entered, error: "" };
  }
  if (entered > share) return { total: null, error: `No puede superar su parte de ${money(share)}.` };
  return { total: entered, error: "" };
}
