/** Proposes explicit total lines, never a largest-number guess or an AI sum. */
export function receiptTotals(text: string) {
  if (/\bUSD\b|US\$|D[ÓO]LARES?/i.test(text)) return { candidatos: [], totalPropuesto: null, necesitaRevision: true, advertencia: "Por ahora solo dividimos boletas en soles. Revisa la moneda antes de continuar." };
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const candidates: { monto: number; linea: string; sinFormatoMonetario: boolean }[] = [];
  function cents(token: string) {
    const normalized = token.replace(/\s/g, "");
    const decimal = normalized.match(/[.,](\d{2})$/);
    const whole = decimal ? normalized.slice(0, -3).replace(/[.,]/g, "") : normalized.replace(/[.,]/g, "");
    const value = Number(whole) * 100 + Number(decimal?.[1] || 0);
    return Number.isSafeInteger(value) && value > 0 && value <= 999_999_999 ? value : null;
  }
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!/\bTOTAL\b|IMPORTE\s+A\s+PAGAR/i.test(line) || /SUB\s*TOTAL|DESCUENTO|IGV|IMPUESTO|ITEM|PRODUCTO|ART[IÍ]CULO/i.test(line)) continue;
    const suffix = line.replace(/^.*?(?:\bTOTAL\b|IMPORTE\s+A\s+PAGAR)/i, "");
    const matches = suffix.match(/\d+(?:[.,]\d{3})*(?:[.,]\d{2})?/g);
    let raw = matches?.length === 1 ? matches[0] : null;
    if (!raw && /^[\s:S/.,PEN]*$/i.test(suffix)) {
      const next = lines[index + 1] || "";
      raw = next.match(/^(?:S\s*\/|PEN)?\s*(\d+(?:[.,]\d{3})*(?:[.,]\d{2})?)\s*$/i)?.[1] || null;
    }
    const monto = raw ? cents(raw) : null;
    const source = `${line}${matches ? "" : ` ${lines[index + 1] || ""}`}`;
    const sinFormatoMonetario = !/[.,]\d{2}$/.test(raw || "") && !/S\s*\/|\bPEN\b|SOLES/i.test(source);
    if (monto && !candidates.some((c) => c.monto === monto)) candidates.push({ monto, linea: source.slice(0, 160), sinFormatoMonetario });
  }
  const unambiguous = candidates.length === 1 && !candidates[0].sinFormatoMonetario;
  return { candidatos: candidates.slice(0, 8), totalPropuesto: unambiguous ? candidates[0].monto : null, necesitaRevision: true, advertencia: unambiguous ? "Total propuesto. Compáralo con la boleta antes de repartir." : candidates.length ? "La lectura no es concluyente. Verifica moneda y decimales; elige el importe correcto o escríbelo." : "No pudimos distinguir el total. Puedes escribirlo o tomar una foto más clara." };
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
