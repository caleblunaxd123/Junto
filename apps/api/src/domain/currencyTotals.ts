import type { CurrencyCode } from '@junto/shared/currency';

/** Separate obligations by currency; a zero net never cancels what you owe and are owed. */
export function currencyTotals(rows: Array<{ moneda: CurrencyCode; debes: number; teDeben: number }>) {
  const totals = new Map<CurrencyCode, { moneda: CurrencyCode; debes: number; teDeben: number }>();
  for (const row of rows) {
    const total = totals.get(row.moneda) ?? { moneda: row.moneda, debes: 0, teDeben: 0 };
    total.debes += row.debes;
    total.teDeben += row.teDeben;
    totals.set(row.moneda, total);
  }
  return [...totals.values()].sort((a, b) => a.moneda.localeCompare(b.moneda));
}
