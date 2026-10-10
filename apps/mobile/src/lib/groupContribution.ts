import type { GrupoConBalance } from "../types";

type Account = GrupoConBalance["resumen"]["cuentas"][number];
/** Reimbursements never increase the bill. Waiting/rejected payments never cover a share. */
export function groupContribution(account: Account) {
  const cubierto = Math.min(account.tuParte, Math.max(0, account.pagaste + account.pagosEnviados - account.pagosRecibidos));
  return {
    parte: account.tuParte,
    cubierto,
    pendiente: Math.max(0, -account.neto),
    porRecuperar: Math.max(0, account.neto),
    porConfirmar: account.pagosPorConfirmar ?? 0,
    progreso: account.tuParte > 0 ? cubierto / account.tuParte : 0,
  };
}
