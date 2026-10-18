import { readPaymentVoucher } from './voucher';
import { receiptWordsCents } from './spanishMoney';
/**
 * Proposes explicit total lines, never a largest-number guess or an AI sum. A line is proposed alone
 * when it is the only clear one, or when the receipt itself confirms it (amount in words, or op.
 * gravada + IGV). Otherwise the options are listed, IMPORTE TOTAL / TOTAL A PAGAR first.
 */
export function receiptTotals(text: string) {
  if (/\bUSD\b|US\$|D[ÓO]LARES?/i.test(text)) return { candidatos: [], totalPropuesto: null, necesitaRevision: true, advertencia: "Por ahora solo dividimos boletas en soles. Revisa la moneda antes de continuar." };
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (/yapeaste|plineaste|transferiste|constancia[\s\S]*cuenta\s+(?:de\s+)?destino/i.test(text) && !/\b(?:BOLETA|FACTURA)\b/i.test(text)) {
    const payment = readPaymentVoucher(text);
    return { candidatos: payment.moneda === 'PEN' ? payment.candidatos.map(monto => ({ monto, linea: 'Importe del comprobante de pago', sinFormatoMonetario: false })) : [], totalPropuesto: null, necesitaRevision: true,
      advertencia: 'Es un comprobante de pago, no una boleta. Si devuelve dinero de un gasto ya anotado, usa «Ya pagué» en el grupo. Si pagaste un gasto nuevo, revisa y elige el importe; no se confirma ningún pago aquí.' };
  }
  // OCR reads "S/" as "5/" and prints "S/." or "PEN": currency marks go before reading the number.
  const withoutCurrency = (value: string) => value.replace(/(?:^|\s)[S5$]\s*\/\s*\.?/gi, " ").replace(/\b(?:PEN|SOLES)\b/gi, " ");
  const amountPattern = /\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?/g;
  function cents(token: string) {
    const normalized = token.replace(/\s/g, "");
    // A blurred last decimal ("80.0") still has its comma: read it as tenths, never as 800.
    const decimal = normalized.match(/[.,](\d{1,2})$/);
    const whole = decimal ? normalized.slice(0, -decimal[0].length).replace(/[.,]/g, "") : normalized.replace(/[.,]/g, "");
    const value = Number(whole) * 100 + Number((decimal?.[1] ?? "0").padEnd(2, "0"));
    return Number.isSafeInteger(value) && value > 0 && value <= 999_999_999 ? value : null;
  }
  /** The last amount with decimals of a line ("IGV 18% S/ 6.47" → 647). Only used to confirm a total. */
  const lineMoney = (line: string) => {
    const found = withoutCurrency(line).match(/\d+(?:[.,]\d{3})*[.,]\d{1,2}(?!\d)/g);
    return found ? cents(found[found.length - 1]) : null;
  };
  const STRONG = /IMPORTE\s+TOTAL|TOTAL\s+A\s+PAGAR|TOTAL\s+VENTA|TOTAL\s+GENERAL|IMPORTE\s+A\s+PAGAR/i;
  // Lines that say "total" but are not what was paid: taxable base, taxes, cash given, change, card.
  const NOT_TOTAL = /SUB\s*TOTAL|DESCUENTO|\bI\.?\s*G\.?\s*V\b|IMPUESTO|ITEM|PRODUCTO|ART[IÍ]CULO|GRAVAD|EXONERAD|INAFECT|GRATUIT|EFECTIVO|VUELTO|CAMBIO|RECIBIDO|PAGO\s+CON|TARJETA|ANTICIPO|REDONDEO|ICBPER|PUNTOS/i;
  type Candidate = { monto: number; raw: string; linea: string; sinFormatoMonetario: boolean; fuerte: boolean; derivado?: boolean };
  const candidates: Candidate[] = [];
  let base = 0, tax = 0, service = 0, subtotal: number | null = null;
  for (let index = 0; index < lines.length; index++) {
    // Normalize only a total label, never OCR digits inside the amount.
    const line = lines[index].replace(/\bT[O0]T[A4]L\b/gi, 'TOTAL').replace(/\bT\s+O\s+T\s+A\s+L\b/gi, 'TOTAL');
    // The receipt's own arithmetic, used only to confirm what a total line says.
    if (/OP\.?\s*(?:GRAVAD|EXONERAD|INAFECT)/i.test(line)) base += lineMoney(line) ?? 0;
    else if (/\bI\.?\s*G\.?\s*V\b/i.test(line) && !STRONG.test(line)) tax += lineMoney(line) ?? 0;
    else if (/SERVICIO|ICBPER|RECARGO/i.test(line)) service += lineMoney(line) ?? 0;
    else if (/SUB\s*TOTAL/i.test(line)) subtotal = lineMoney(line);
    if (!/\bTOTAL\b|IMPORTE\s+A\s+PAGAR/i.test(line) || NOT_TOTAL.test(line)) continue;
    const suffix = line.replace(/^.*?(?:\bTOTAL\b|IMPORTE\s+A\s+PAGAR)/i, "");
    const matches = withoutCurrency(suffix).match(amountPattern);
    let raw = matches?.length === 1 ? matches[0] : null;
    if (!raw && /^[\s:S5/.,PEN]*$/i.test(suffix)) {
      const next = lines[index + 1] || "";
      raw = withoutCurrency(next).match(/^\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{1,2})?)\s*$/)?.[1] || null;
    }
    const monto = raw ? cents(raw) : null;
    const source = `${line}${matches ? "" : ` ${lines[index + 1] || ""}`}`;
    const sinFormatoMonetario = /[.,]\d$/.test(raw || "") || (!/[.,]\d{2}$/.test(raw || "") && !/[S5]\s*\/|\bPEN\b|SOLES/i.test(source));
    if (monto && !candidates.some((c) => c.monto === monto)) candidates.push({ monto, raw: raw!, linea: source.slice(0, 160), sinFormatoMonetario, fuerte: STRONG.test(line) });
  }
  // "2050." and "20.50" are one reading of the same digits: keep the one with its decimals.
  const digits = (value: string) => value.replace(/\D/g, "");
  for (let i = candidates.length - 1; i >= 0; i--) {
    const c = candidates[i];
    if (!/[.,]\d{1,2}$/.test(c.raw) && candidates.some((other) => other !== c && /[.,]\d{1,2}$/.test(other.raw) && digits(other.raw) === digits(c.raw))) candidates.splice(i, 1);
  }
  const expected = new Set<number>();
  if (base && tax) expected.add(base + tax + service);
  if (subtotal) { expected.add(subtotal + service); if (tax) expected.add(subtotal + tax + service); }
  const words = receiptWordsCents(text);
  if (!candidates.length && words) candidates.push({ monto: words, raw: "", linea: "Importe en letras de la boleta", sinFormatoMonetario: false, fuerte: true });
  // A blurred total ("80.1") that disagrees with the receipt's own sum: offer that sum as an option too.
  const sum = base + tax + service;
  if (base && tax && !candidates.some((c) => Math.abs(c.monto - sum) <= 1)) candidates.push({ monto: sum, raw: "", linea: "Op. gravada + IGV de la boleta", sinFormatoMonetario: true, fuerte: false, derivado: true });
  // Confirmed: the amount in words or the receipt's own sum agrees (±1 céntimo of rounding).
  const confirmed = (c: Candidate) => words === c.monto || (!c.derivado && [...expected].some((value) => Math.abs(value - c.monto) <= 1));
  const distinct = (list: Candidate[]) => [...new Set(list.map((c) => c.monto))];
  const sure = distinct(candidates.filter(confirmed));
  // Two different totals and nothing on the receipt to settle it: list both, never guess.
  const totalPropuesto = sure.length === 1 ? sure[0] : candidates.length === 1 && !candidates[0].sinFormatoMonetario ? candidates[0].monto : null;
  // The likeliest first: the proposal, then confirmed amounts, then IMPORTE TOTAL / TOTAL A PAGAR.
  const ordered = [...candidates].sort((a, b) => Number(b.monto === totalPropuesto) - Number(a.monto === totalPropuesto) || Number(confirmed(b)) - Number(confirmed(a)) || Number(b.fuerte) - Number(a.fuerte));
  return {
    candidatos: ordered.slice(0, 8).map(({ monto, linea, sinFormatoMonetario }) => ({ monto, linea, sinFormatoMonetario })),
    totalPropuesto, necesitaRevision: true,
    advertencia: totalPropuesto !== null
      ? sure.length === 1 ? "Total propuesto: coincide con las cuentas de la boleta. Compáralo antes de repartir." : "Total propuesto. Compáralo con la boleta antes de repartir."
      : candidates.length ? "La lectura no es concluyente. Verifica moneda y decimales; elige el importe correcto o escríbelo." : "No pudimos distinguir el total. Puedes escribirlo o tomar una foto más clara.",
  };
}

/** Conservative OCR proposals: only a named line ending in an explicit two-decimal amount.
 * One OCR pass only (joining passes would duplicate products). Never auto-assign or auto-approve. */
export function receiptItems(text: string) {
  if (/\bUSD\b|US\$|D[ÓO]LARES?|\bEUR\b|\bCOP\b/i.test(text)) return [];
  const items: { nombre: string; monto: number; linea: string }[] = [];
  for (const source of text.split(/\r?\n/)) {
    const line = source.trim();
    if (/\bTOTAL\b|SUB\s*TOTAL|IGV|IMPUESTO|DESCUENTO|PROPINA|CAMBIO|VUELTO|EFECTIVO|TARJETA|RUC|FECHA|HORA|BOLETA|FACTURA|CAJERO|DIRECCI[ÓO]N|TEL[ÉE]FONO/i.test(line)) continue;
    const match = line.match(/^(.+?)\s+(?:S\s*\/\s*)?(\d{1,7}[.,]\d{2})$/i);
    if (!match || !/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(match[1])) continue;
    const amounts = match[1].match(/\d+[.,]\d{2}/g) || [];
    // At most one unit price before the final line total; reject unrelated amounts.
    if (amounts.length > 1) continue;
    let name = match[1].replace(/\s+\d+[.,]\d{2}$/, "").replace(/^\d{1,3}\s*(?:[xX]\s*)?\s+/, "").trim();
    if (!name || name.length > 100 || /^\d/.test(name)) continue;
    const [whole, fraction] = match[2].split(/[.,]/);
    const amount = Number(whole) * 100 + Number(fraction);
    if (amount <= 0 || amount > 999_999_999) continue;
    items.push({ nombre: name, monto: amount, linea: line.slice(0, 160) });
    if (items.length === 100) break;
  }
  return items;
}
