import { memberLabels } from "./people";

type Group = {
  id: string;
  nombre: string;
  miembros: { usuarioId: string; usuario: { id: string; nombre: string; email?: string | null } }[];
  resumen: { saldos?: { deudorId: string; deudorNombre: string; acreedorId: string; acreedorNombre: string; monto: number }[] };
};
type Payment = {
  id: string; grupoId: string; pagadorId: string; receptorId: string; monto: number; estado: string; metodo?: string | null;
  comprobante?: { id: string } | null;
  permisos?: { aprobar: boolean };
};

export type PendingAction =
  | { kind: "confirmar"; key: string; pagoId: string; grupoId: string; grupo: string; persona: string; monto: number; metodo?: string | null; conComprobante: boolean }
  | { kind: "revisar"; key: string; pagoId: string; grupoId: string; grupo: string; persona: string; receptor: string; monto: number; conComprobante: boolean }
  | { kind: "pagar"; key: string; grupoId: string; grupo: string; personaId: string; persona: string; nombreCompleto: string; monto: number; enEspera: boolean; activo: boolean }
  | { kind: "cobrar"; key: string; grupoId: string; grupo: string; personaId: string; persona: string; monto: number; porConfirmar: boolean; activo: boolean };

/**
 * Everything that needs the viewer: payments to confirm first (as receiver, then as approving admin),
 * then what they owe, then what they are owed.
 */
export function pendingActions(groups: Group[], payments: Payment[], meId?: string | null): PendingAction[] {
  if (!meId) return [];
  const confirm: PendingAction[] = [];
  const review: PendingAction[] = [];
  const pay: PendingAction[] = [];
  const collect: PendingAction[] = [];
  for (const group of groups) {
    const labels = memberLabels(group.miembros.map((m) => ({ ...m.usuario, id: m.usuarioId })), meId);
    const active = new Set(group.miembros.map((m) => m.usuarioId));
    const name = (id: string, fallback: string) => labels.get(id) ?? fallback.split(" ")[0];
    const waiting = payments.filter((p) => p.grupoId === group.id && p.estado === "reportado");
    for (const p of waiting.filter((p) => p.receptorId === meId)) {
      const payer = group.miembros.find((m) => m.usuarioId === p.pagadorId)?.usuario.nombre ?? "Alguien";
      confirm.push({ kind: "confirmar", key: `c-${p.id}`, pagoId: p.id, grupoId: group.id, grupo: group.nombre, persona: name(p.pagadorId, payer), monto: p.monto, metodo: p.metodo, conComprobante: !!p.comprobante });
    }
    // Payments between other people that this admin may approve (the server decides who may).
    for (const p of waiting.filter((p) => p.permisos?.aprobar && p.receptorId !== meId && p.pagadorId !== meId)) {
      const payer = group.miembros.find((m) => m.usuarioId === p.pagadorId)?.usuario.nombre ?? "Alguien";
      const receiver = group.miembros.find((m) => m.usuarioId === p.receptorId)?.usuario.nombre ?? "alguien";
      review.push({ kind: "revisar", key: `v-${p.id}`, pagoId: p.id, grupoId: group.id, grupo: group.nombre, persona: name(p.pagadorId, payer), receptor: name(p.receptorId, receiver), monto: p.monto, conComprobante: !!p.comprobante });
    }
    for (const s of group.resumen.saldos ?? []) {
      if (s.deudorId === meId)
        pay.push({ kind: "pagar", key: `p-${group.id}-${s.acreedorId}`, grupoId: group.id, grupo: group.nombre, personaId: s.acreedorId, persona: name(s.acreedorId, s.acreedorNombre), nombreCompleto: s.acreedorNombre, monto: s.monto, enEspera: waiting.some((p) => p.pagadorId === meId && p.receptorId === s.acreedorId), activo: active.has(s.acreedorId) });
      else if (s.acreedorId === meId && !waiting.some((p) => p.receptorId === meId && p.pagadorId === s.deudorId && p.monto >= s.monto))
        // A payment already waiting for your answer covers it: the "¿Lo recibiste?" card says it all.
        collect.push({ kind: "cobrar", key: `r-${group.id}-${s.deudorId}`, grupoId: group.id, grupo: group.nombre, personaId: s.deudorId, persona: name(s.deudorId, s.deudorNombre), monto: s.monto, porConfirmar: waiting.some((p) => p.receptorId === meId && p.pagadorId === s.deudorId), activo: active.has(s.deudorId) });
    }
  }
  return [...confirm, ...review, ...pay, ...collect];
}
