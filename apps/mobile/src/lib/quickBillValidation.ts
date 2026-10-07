import { calculateQuickBill, QuickBillInput, QuickBillResult } from "@junto/shared/quickBill";
import { parseMoney } from "./expensePreview";

type BillFields = {
  name: string; recipient: string; instructions: string; billTotal: string; extras: string;
  division: "igual" | "consumos"; scanApproved: boolean; names: string;
  people: { id: string; nombre: string; consumo: string; invitado: boolean }[];
};
export function validateQuickBillDraft(d: BillFields) {
  const fields: Record<string, string> = {};
  const total = parseMoney(d.billTotal);
  const extras = parseMoney(d.extras);
  if (total === null || total <= 0) fields.total = "Escribe el total de la cuenta: mayor que cero, máximo 2 decimales.";
  if (!d.scanApproved) fields.scan = "Revisa y confirma el total leído de la foto antes de continuar.";
  if (extras === null) fields.extras = "Escribe extras válidos; usa 0 si no hay. No pueden ser negativos.";
  if (d.name.trim().length < 2 || d.name.trim().length > 100) fields.name = "Usa entre 2 y 100 caracteres para el nombre de la cuenta.";
  if (d.recipient.trim().length > 100) fields.recipient = "El nombre de quien recibe no debe superar 100 caracteres.";
  if (d.instructions.trim().length > 500) fields.instructions = "Las instrucciones no deben superar 500 caracteres.";
  if (d.names.trim()) fields.names = "Pulsa Usar estos nombres o borra la lista antes de continuar.";
  if (!d.people.length || d.people.length > 50) fields.people = "Añade entre 1 y 50 personas.";
  if (d.people.length && d.people.every((p) => p.invitado)) fields.people = "Al menos una persona debe aportar. No pueden ser todos invitados.";
  const names = new Map<string, string>();
  const participants = d.people.map((p) => {
    const name = p.nombre.trim();
    const key = name.replace(/\s+/g, " ").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (!name || name.length > 100 || /[\u0000-\u001f\u007f]/.test(name)) fields[`name:${p.id}`] = "Escribe un nombre válido, de hasta 100 caracteres.";
    else if (names.has(key)) { fields[`name:${p.id}`] = "Este nombre está repetido. Añade un apellido."; fields[`name:${names.get(key)}`] = fields[`name:${p.id}`]; }
    else names.set(key, p.id);
    const consumo = d.division === "igual" ? 0 : parseMoney(p.consumo);
    if (consumo === null) fields[`amount:${p.id}`] = "Indica su consumo con máximo 2 decimales. Usa 0 si no consumió.";
    return { ...p, nombre: name, consumo: consumo ?? 0 };
  });
  const consumptions = participants.reduce((sum, p) => sum + p.consumo, 0);
  const validAmounts = !Object.keys(fields).some((key) => key.startsWith("amount:"));
  const difference = total !== null && validAmounts && d.division === "consumos" ? total - consumptions : null;
  if (difference !== null && difference !== 0) fields.reconciliation = `${difference > 0 ? "Faltan" : "Sobran"} S/ ${(Math.abs(difference) / 100).toFixed(2)} por asignar. Corrige los consumos o revisa el total del primer paso; no se reparte la diferencia automáticamente.`;
  if (total !== null && extras !== null && total + extras > 999_999_999) fields.extras = "La cuenta más los extras no puede superar S/ 9,999,999.99.";
  let input: QuickBillInput | undefined;
  let result: QuickBillResult | undefined;
  if (total && extras !== null && !Object.keys(fields).some((key) => key !== "name" && key !== "recipient" && key !== "instructions" && key !== "scan" && key !== "names")) {
    input = { nombre: d.name.trim(), cobrarA: d.recipient.trim(), instrucciones: d.instructions.trim(), totalCuenta: total, extras, division: d.division, participantes: participants };
    try { result = calculateQuickBill(input); }
    catch (err) { fields.people = (err as Error).message; input = undefined; }
  }
  const firstError = (keys: string[]) => keys.map((key) => fields[key]).find(Boolean) || "";
  const stepErrors = [firstError(["total", "scan"]), firstError(["total", "scan", "people", ...d.people.flatMap((p) => [`name:${p.id}`, `amount:${p.id}`]), "extras", "names", "reconciliation"]), Object.values(fields)[0] || ""];
  return { fields, total, extras, consumptions, difference, input, result, stepErrors, valid: !Object.keys(fields).length && !!result };
}
