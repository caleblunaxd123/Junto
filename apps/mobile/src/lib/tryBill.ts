import { calculateQuickBill, type QuickBillInput, type QuickBillResult } from "@junto/shared/quickBill";
import { parseMoney } from "./expensePreview";
import type { ShareMessage, SharePreview } from "./shareMessage";

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

/** Presentation metadata is derived from the same calculation, never parsed from prose. */
export function quickBillSharePreview(input: QuickBillInput, aportes?: Record<string, number>): SharePreview {
  const result = calculateQuickBill(input);
  const guests = result.partes.filter(person => person.invitado).length;
  return {
    title: input.nombre, total: result.montoTotal, totalLabel: "Total de la cuenta",
    caption: `${result.cantidadPagadores} ${result.cantidadPagadores === 1 ? "persona aporta" : "personas aportan"}${guests ? ` · ${guests} ${guests === 1 ? "invitado" : "invitados"}` : ""}`,
    rowsHeading: "Aportes por persona",
    ...(input.cobrarA || input.instrucciones ? { payment: { recipient: input.cobrarA, instructions: input.instrucciones } } : {}),
    rows: result.partes.map(person => ({ id: person.id, name: person.nombre, amount: person.total,
      ...(person.invitado ? { detail: "Invitado/a · no aporta", tone: "guest" as const } : aportes ? {
        detail: `Confirmado S/ ${((aportes[person.id] || 0) / 100).toFixed(2)} · Pendiente S/ ${((person.total - (aportes[person.id] || 0)) / 100).toFixed(2)}`,
      } : {}),
    })),
    note: result.totalExtras ? `Incluye S/ ${(result.totalExtras / 100).toFixed(2)} de extras.` : "Cada céntimo está incluido en el reparto.",
    reconciled: true,
  };
}

export function tryBillShareMessage(input: QuickBillInput): ShareMessage {
  const result = calculateQuickBill(input);
  const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
  return { subject: "JUNTO · Cuenta dividida", preview: quickBillSharePreview(input), body: [
    "CUENTA DIVIDIDA · JUNTO", `Total: ${money(result.montoTotal)} · ${result.cantidadPagadores} aportan`,
    ...(result.totalExtras ? [`Incluye propina extra de ${money(result.totalExtras)}.`] : []), "",
    ...result.partes.map(person => `${person.nombre}: ${person.invitado ? "invitado/a · no paga" : money(person.total)}`),
    "", "La suma coincide con el total, incluido el último céntimo.",
    "Cálculo sin guardar ni registrar pagos. JUNTO no cobra ni transfiere dinero.",
  ].join("\n") };
}
