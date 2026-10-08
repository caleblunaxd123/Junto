import { centavosASoles } from "../types";

const money = (cents: number) => `S/ ${centavosASoles(cents)}`;

export type VoucherCheck = {
  tone: "danger" | "warning" | "info";
  text: string;
  /** A one-tap correction, e.g. register only what is owed. */
  fix?: { label: string; monto: number };
};

type Reading = {
  leido: boolean;
  monto: number | null;
  duplicado: string | null;
  sugerenciaReceptorId: string | null;
  destinatario: string | null;
  advertencias: string[];
};

/**
 * What the payer should look at before sending a voucher for approval. A "danger" check blocks
 * sending; the rest are things the approver will also see.
 */
export function voucherChecks(input: {
  lectura: Reading | null;
  monto: number | null;
  limite: number;
  receptorId: string | null;
  nombre: (id: string) => string;
  /** People the payer owes in this group. */
  acreedores: string[];
}): VoucherCheck[] {
  const { lectura, monto, limite, receptorId, nombre, acreedores } = input;
  if (!lectura) return [];
  const checks: VoucherCheck[] = [];
  if (lectura.duplicado) checks.push({ tone: "danger", text: `${lectura.duplicado} Sube la captura de este pago.` });
  if (lectura.monto && receptorId && limite > 0 && lectura.monto > limite)
    checks.push({
      tone: "warning",
      text: `El comprobante dice ${money(lectura.monto)}, pero le debes ${money(limite)} a ${nombre(receptorId)}. Registra ${money(limite)} y conversen la diferencia.`,
      ...(monto !== limite ? { fix: { label: `Registrar ${money(limite)}`, monto: limite } } : {}),
    });
  else if (lectura.monto && monto && lectura.monto !== monto)
    checks.push({ tone: "warning", text: `El comprobante dice ${money(lectura.monto)} y vas a registrar ${money(monto)}. Quien aprueba verá ambos montos.` });
  const suggested = lectura.sugerenciaReceptorId;
  if (suggested && receptorId && suggested !== receptorId)
    checks.push({
      tone: "warning",
      text: acreedores.includes(suggested)
        ? `El comprobante parece ser para ${nombre(suggested)}, no para ${nombre(receptorId)}. Revisa a quién le pagaste.`
        : `El comprobante parece ser para ${nombre(suggested)}, y no le debes nada en este grupo. Revisa la captura.`,
    });
  else if (lectura.destinatario && !suggested && receptorId)
    checks.push({ tone: "info", text: `En el comprobante figura «${lectura.destinatario}». Revisa que sea ${nombre(receptorId)}.` });
  for (const text of lectura.advertencias) checks.push({ tone: lectura.leido ? "warning" : "info", text });
  return checks;
}

export const blocksSending = (checks: VoucherCheck[]) => checks.some((check) => check.tone === "danger");

/** Who has to approve, in one sentence, named the way the viewer sees people. */
export function approvalSentence(receptor: string, admins: string[]) {
  if (!admins.length) return `Lo aprueba ${receptor}, quien recibe el dinero.`;
  return `Lo aprueba ${receptor} (quien recibe) o ${admins.join(" o ")} (administración del grupo).`;
}

type PaymentLike = {
  estado: string;
  monto: number;
  pagadorId: string;
  receptorId: string;
  resueltoPor?: string | null;
};

/** Headline for a payment, from the viewer's point of view. */
export function paymentHeadline(pago: PaymentLike, meId: string | undefined, nombre: (id: string) => string) {
  const amount = money(pago.monto);
  const byOther = !!pago.resueltoPor && pago.resueltoPor !== pago.receptorId;
  switch (pago.estado) {
    case "reportado":
      return {
        tone: "waiting" as const,
        title: "Esperando aprobación",
        body: pago.receptorId === meId
          ? `${nombre(pago.pagadorId)} dice que te pagó ${amount}. Revisa tu Yape, Plin o cuenta antes de aprobar.`
          : pago.pagadorId === meId
            ? `Tu deuda baja cuando lo aprueben. Mientras tanto no cambia.`
            : `${nombre(pago.pagadorId)} registró ${amount} para ${nombre(pago.receptorId)}. La deuda no cambia hasta que lo aprueben.`,
      };
    case "exitoso":
      return {
        tone: "ok" as const,
        title: !byOther ? "Pago confirmado" : pago.resueltoPor === meId ? "Lo aprobaste" : `Aprobado por ${nombre(pago.resueltoPor!)}`,
        body: byOther
          ? `La deuda bajó ${amount}. ${pago.receptorId === meId ? "Si no te llegó, avísalo abajo." : `${nombre(pago.receptorId)} puede indicar si no le llegó.`}`
          : pago.receptorId === meId
            ? `Confirmaste que recibiste ${amount}. La deuda bajó por ese monto.`
            : `${nombre(pago.receptorId)} confirmó que recibió ${amount}. La deuda bajó por ese monto.`,
      };
    case "rechazado":
      return {
        tone: "bad" as const,
        title: pago.resueltoPor === pago.receptorId ? `${pago.receptorId === meId ? "Indicaste" : `${nombre(pago.receptorId)} indicó`} que no llegó` : "No fue aprobado",
        body: "La deuda sigue pendiente. Conversen y, si hace falta, registra el pago otra vez con el comprobante correcto.",
      };
    default:
      return { tone: "bad" as const, title: "Pago cancelado", body: "La cuenta que debía confirmarlo ya no existe." };
  }
}
