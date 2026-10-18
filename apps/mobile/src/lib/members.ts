import { formatMoney } from "@junto/shared/currency";
import type { ShareMessage } from "./shareMessage";
import { invitationUrl } from "./invitation";
import { type GrupoConBalance } from "../types";

type Member = GrupoConBalance["miembros"][number];
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Added by name only: no JUNTO account yet. */
export const sinCuenta = (member: Pick<Member, "usuario">) => !!member.usuario.sinCuenta;

/**
 * The WhatsApp message for someone added by name: what they owe (or are owed) and their personal
 * link, which lets them join as themselves and see the detail.
 */
export function personalInvite(group: GrupoConBalance, member: Member, senderName: string): ShareMessage {
  const money = (value: number) => formatMoney(value, group.moneda);
  const url = (!group.estado || group.estado === 'abierto') && member.codigoPersonal ? invitationUrl(member.codigoPersonal) : "";
  const name = firstName(member.usuario.nombre);
  const owes = (group.resumen.saldos ?? []).filter((s) => s.deudorId === member.usuarioId);
  const owed = (group.resumen.saldos ?? []).filter((s) => s.acreedorId === member.usuarioId);
  const lines = [
    `Hola ${name} 👋 Anoté los gastos de «${group.nombre}» en JUNTO.`,
    ...owes.map((s) => `Te toca pagarle ${money(s.monto)} a ${firstName(s.acreedorNombre)}.`),
    ...owed.map((s) => `${firstName(s.deudorNombre)} te debe ${money(s.monto)}.`),
    ...(!owes.length && !owed.length ? ["Por ahora estás a mano."] : []),
    url ? `Mira el detalle y únete como ${name} aquí (sin instalar nada): ${url}` : "",
    `— ${firstName(senderName)}`,
  ].filter(Boolean);
  return { subject: `Tus cuentas de «${group.nombre}» en JUNTO`, body: lines.join("\n") };
}

/** Direct WhatsApp draft (https://wa.me/51XXXXXXXXX?text=...) with their personal link when a phone was saved. */
export function personalWhatsAppUrl(group: GrupoConBalance, member: Member, senderName: string) {
  const phone = (member.usuario.celular ?? "").replace(/^\+?51\s*/, "").replace(/\D/g, "");
  if (!/^9\d{8}$/.test(phone)) return null;
  return `https://wa.me/51${phone}?text=${encodeURIComponent(personalInvite(group, member, senderName).body)}`;
}
