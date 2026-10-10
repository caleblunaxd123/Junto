import type { Gasto, GrupoConBalance, Saldo } from "../types";
import {
  expenseShareMessage as sharedExpense,
  groupShareMessage as sharedGroup,
  validShareEmail,
  type ShareMessage,
  type SharePreview,
} from "@junto/shared/share";

export { validShareEmail };
export type { ShareMessage, SharePreview };
const line = (value: string) => value.replace(/[\r\n\u0000-\u001f]/g, " ").trim();

export function emailDraftUrl(message: ShareMessage, recipient = "") {
  if (recipient && !validShareEmail(recipient)) throw new Error("Revisa el correo del destinatario.");
  return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(line(message.subject))}&body=${encodeURIComponent(message.body)}`;
}

export function whatsappDraftUrl(message: ShareMessage, web = false, recipient = "") {
  const value = recipient.replace(/\s/g, "");
  if (value && !/^(?:\+?51)?9\d{8}$/.test(value)) throw new Error("Escribe un celular peruano válido.");
  const phone = value ? `51${value.slice(-9)}` : "";
  // Opens a draft only: WhatsApp still requires the person to press Send.
  return web
    ? `https://wa.me/${phone}?text=${encodeURIComponent(message.body)}`
    : `whatsapp://send?${phone ? `phone=${phone}&` : ""}text=${encodeURIComponent(message.body)}`;
}

/** Same text, preview and e-mail as the API builds; `resource` lets the API send it from server data. */
export function expenseShareMessage(expense: Pick<Gasto, "descripcion" | "montoTotal" | "pagador" | "participantes"> & { id?: string }, groupName: string): ShareMessage {
  return { ...sharedExpense(expense, groupName), ...(expense.id ? { resource: { tipo: "gasto" as const, id: expense.id } } : {}) };
}

export function groupShareMessage(group: Pick<GrupoConBalance, "nombre" | "resumen"> & { id?: string; saldos: Pick<Saldo, "deudorNombre" | "acreedorNombre" | "monto">[] }, pendingPayments = 0): ShareMessage {
  return { ...sharedGroup(group, pendingPayments), ...(group.id ? { resource: { tipo: "grupo" as const, id: group.id } } : {}) };
}
