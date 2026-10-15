import type { GrupoConBalance, Pago } from "../types";
import type { CurrencyCode } from "@junto/shared/currency";
import { formatMoney } from "@junto/shared/currency";

/** Expense advances and settlement payments are different contributions. */
export function groupAccountExplanation(account: Pick<GrupoConBalance['resumen']['cuentas'][number], 'pagaste' | 'tuParte' | 'pagosEnviados' | 'pagosRecibidos'> | undefined, everyoneSame: boolean, moneda = "PEN") {
  if (!account) return "";
  const money = (amount: number) => formatMoney(amount, moneda);
  const parts: string[] = [];
  if (account.pagaste > 0) parts.push(`Adelantaste ${money(account.pagaste)} en gastos`);
  else if (account.tuParte > 0 && !account.pagosEnviados) parts.push("No has adelantado gastos");
  if (account.tuParte > 0) parts.push(everyoneSame && account.pagaste > 0 ? `a cada uno le toca ${money(account.tuParte)}` : `${parts.length ? "tu" : "Tu"} parte es ${money(account.tuParte)}`);
  if (account.pagosEnviados > 0) parts.push(`Pagaste a otros ${money(account.pagosEnviados)}`);
  if (account.pagosRecibidos > 0) parts.push(`Te pagaron ${money(account.pagosRecibidos)}`);
  return parts.join(" · ");
}

/** Group debts stay separate. Being owed in A cannot pay your debt in B. */
export function accountSummary(
  groups: GrupoConBalance[],
  payments: Pago[] = [],
) {
  const ids = new Set(groups.map((group) => group.id));
  const buckets = new Map<CurrencyCode, { moneda: CurrencyCode; owed: number; owes: number }>();
  for (const group of groups) {
    const moneda = group.moneda ?? "PEN";
    const bucket = buckets.get(moneda) ?? { moneda, owed: 0, owes: 0 };
    bucket.owed += group.balanceUsuario.teDeben;
    bucket.owes += group.balanceUsuario.debes;
    buckets.set(moneda, bucket);
  }
  const byCurrency = [...buckets.values()];
  if (!byCurrency.length) byCurrency.push({ moneda: "PEN", owed: 0, owes: 0 });
  return {
    byCurrency,
    // Legacy callers may show a single total only when it has exactly one currency.
    owed: byCurrency.length === 1 ? byCurrency[0].owed : null,
    owes: byCurrency.length === 1 ? byCurrency[0].owes : null,
    current: groups.filter((group) => group.balanceUsuario.neto === 0).length,
    pending: payments.filter(
      (payment) => ids.has(payment.grupoId) && payment.estado === "reportado",
    ),
  };
}
