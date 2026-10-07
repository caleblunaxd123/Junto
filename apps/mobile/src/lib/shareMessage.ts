import type { Gasto, GrupoConBalance, Saldo } from "../types";

export type SharePreview = {
  title: string;
  total: number;
  totalLabel: string;
  caption: string;
  rowsHeading: string;
  rows: { id: string; name: string; amount: number; detail?: string; breakdown?: string; tone?: "guest" | "settled" | "receivable" | "payable" }[];
  payment?: { recipient: string; instructions: string };
  transfers?: { from: string; to: string; amount: number }[];
  note: string;
  reconciled?: boolean;
};
export type ShareMessage = { subject: string; body: string; preview?: SharePreview };
const money = (value: number) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error("Monto inválido para compartir.");
  return `S/ ${(value / 100).toFixed(2)}`;
};
// Names remain names in the exported report, never a misleading «Tú» for its recipient.
const line = (value: string) => value.replace(/[\r\n\u0000-\u001f]/g, " ").trim();
const footer = "JUNTO calcula y registra; no cobra ni transfiere dinero. Los pagos se hacen por fuera de la app.";

export function validShareEmail(value: string) {
  if (value.length > 254 || !/^[A-Z0-9._%+-]+@(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?$/i.test(value)) return false;
  const local = value.split("@")[0];
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..");
}

export function emailDraftUrl(message: ShareMessage, recipient = "") {
  if (recipient && !validShareEmail(recipient)) throw new Error("Revisa el correo del destinatario.");
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(line(message.subject))}&body=${encodeURIComponent(message.body)}`;
}

export function whatsappDraftUrl(message: ShareMessage, web = false) {
  // No recipient is chosen automatically; the person chooses the chat in WhatsApp.
  return `${web ? "https://wa.me/?" : "whatsapp://send?"}text=${encodeURIComponent(message.body)}`;
}

export function expenseShareMessage(expense: Gasto, groupName: string): ShareMessage {
  const assigned = expense.participantes.reduce((sum, person) => sum + person.montoAsignado, 0);
  if (assigned !== expense.montoTotal) throw new Error("El reparto no coincide con el total. Actualiza el gasto antes de compartir.");
  return {
    subject: `JUNTO · ${line(expense.descripcion)}`,
    preview: {
      title: line(expense.descripcion), total: expense.montoTotal, totalLabel: "Total del gasto",
      caption: `${line(groupName)} · Adelantó ${line(expense.pagador.nombre)}`,
      rowsHeading: "Parte de cada persona",
      rows: expense.participantes.map((person, i) => ({ id: String(i), name: line(person.usuario.nombre), amount: person.montoAsignado })),
      note: "Estas son las partes del gasto, no las deudas pendientes del grupo.", reconciled: true,
    },
    body: [
      `GASTO COMPARTIDO · ${line(groupName)} · JUNTO`,
      line(expense.descripcion),
      `Total del gasto: ${money(expense.montoTotal)}`,
      `Adelantó: ${line(expense.pagador.nombre)}`,
      "", "Parte de cada persona:",
      ...expense.participantes.map(person => `• ${line(person.usuario.nombre)}: ${money(person.montoAsignado)}`),
      "", "Estas son las partes de este gasto, no los saldos pendientes. Otros gastos y pagos confirmados pueden cambiar lo que debe cada persona.",
      "", footer,
    ].join("\n"),
  };
}

export function groupShareMessage(group: GrupoConBalance & { saldos: Saldo[] }, pendingPayments = 0): ShareMessage {
  return {
    subject: `JUNTO · Cuentas de ${line(group.nombre)}`,
    preview: {
      title: line(group.nombre), total: group.resumen.totalGastado, totalLabel: "Total gastado en el grupo",
      caption: `${group.resumen.cantidadGastos} gastos · Solo pagos confirmados`, rowsHeading: "Saldos de cada persona",
      rows: group.resumen.cuentas.map((person, i) => ({
        id: String(i), name: line(person.nombre), amount: Math.abs(person.neto),
        detail: person.neto > 0 ? "Por cobrar" : person.neto < 0 ? "Por pagar" : "Al día",
        breakdown: `Parte ${money(person.tuParte)} · Adelantó ${money(person.pagaste)}`,
        tone: person.neto > 0 ? "receivable" : person.neto < 0 ? "payable" : "settled",
      })),
      transfers: group.saldos.map(saldo => ({ from: line(saldo.deudorNombre), to: line(saldo.acreedorNombre), amount: saldo.monto })),
      note: pendingPayments ? `${pendingPayments} pago(s) por confirmar. Todavía no descuentan la deuda.` : "Los saldos incluyen los gastos y los pagos confirmados. No son saldos bancarios.",
    },
    body: [
      `CUENTAS DEL GRUPO · ${line(group.nombre)} · JUNTO`,
      `Total gastado: ${money(group.resumen.totalGastado)} (${group.resumen.cantidadGastos} gastos)`,
      "", "Cómo queda cada persona:",
      ...group.resumen.cuentas.map(person => `${line(person.nombre)} · Parte: ${money(person.tuParte)} · Adelantó: ${money(person.pagaste)} · ${person.neto > 0 ? `Por cobrar: ${money(person.neto)}` : person.neto < 0 ? `Por pagar: ${money(-person.neto)}` : "Al día"}`),
      "", "Quién paga a quién:",
      ...(group.saldos.length ? group.saldos.map(saldo => `• ${line(saldo.deudorNombre)} → ${line(saldo.acreedorNombre)}: ${money(saldo.monto)}`) : [group.resumen.cantidadGastos ? "Todos están al día." : "Todavía no hay gastos registrados."]),
      "", ...(pendingPayments ? [`Hay ${pendingPayments} pago(s) esperando confirmación: todavía NO descuentan la deuda.`] : []),
      "Los saldos incluyen solo pagos confirmados. Se compensan los gastos para reducir el número de pagos.",
      "", footer,
    ].join("\n"),
  };
}
