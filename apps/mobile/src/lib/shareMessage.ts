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

export function whatsappDraftUrl(message: ShareMessage, web = false) {
  // No recipient is chosen automatically; the person chooses the chat in WhatsApp.
  return `${web ? "https://wa.me/?" : "whatsapp://send?"}text=${encodeURIComponent(message.body)}`;
}

/** Same text, preview and e-mail as the API builds; `resource` lets the API send it from server data. */
export function expenseShareMessage(expense: Pick<Gasto, "descripcion" | "montoTotal" | "pagador" | "participantes"> & { id?: string }, groupName: string): ShareMessage {
  return { ...sharedExpense(expense, groupName), ...(expense.id ? { resource: { tipo: "gasto" as const, id: expense.id } } : {}) };
}

export function groupShareMessage(group: Pick<GrupoConBalance, "nombre" | "resumen"> & { id?: string; saldos: Pick<Saldo, "deudorNombre" | "acreedorNombre" | "monto">[] }, pendingPayments = 0): ShareMessage {
  return { ...sharedGroup(group, pendingPayments), ...(group.id ? { resource: { tipo: "grupo" as const, id: group.id } } : {}) };
}
