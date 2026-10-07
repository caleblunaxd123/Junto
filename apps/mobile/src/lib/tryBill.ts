import { calculateQuickBill, type QuickBillInput, type QuickBillResult } from "@junto/shared/quickBill";
import { parseMoney } from "./expensePreview";

/** The anonymous demo follows the same exact-cent rules as saved bills. */
export function previewTryBill(text: string, people: number, guests: number, tip: number): { input?: QuickBillInput; result?: QuickBillResult; extras: number; error: string } {
  if (!Number.isInteger(people) || people < 1 || people > 30 || !Number.isInteger(guests) || guests < 0 || guests >= people || ![0, 5, 10, 15].includes(tip))
    return { extras: 0, error: "Revisa las personas: al menos una debe aportar." };
  if (!text.trim()) return { extras: 0, error: "" };
  const cents = parseMoney(text);
  if (cents === null) return { extras: 0, error: "Escribe un monto en soles, con hasta 2 decimales y máximo S/ 9,999,999.99." };
  if (!cents) return { extras: 0, error: "La cuenta debe ser mayor que S/ 0.00." };
  const extras = Math.round(cents * tip / 100);
  const input: QuickBillInput = { nombre: "Cuenta", cobrarA: "", instrucciones: "", division: "igual", totalCuenta: cents, extras,
    participantes: Array.from({ length: people }, (_, i) => ({ id: `p${i}`, nombre: `Persona ${i + 1}`, consumo: 0, invitado: i >= people - guests })) };
  try { return { input, result: calculateQuickBill(input), extras, error: "" }; }
  catch (error) { return { extras, error: (error as Error).message }; }
}

export { quickBillSharePreview, tryBillShareMessage } from "@junto/shared/share";
