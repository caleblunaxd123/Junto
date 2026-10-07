/**
 * Reads the text of a Yape, Plin or bank transfer screenshot. Yape and Plin have no public API to
 * verify a transfer between people, so this only proposes values: the payer reviews them and the
 * receiver (or an admin, if the group allows it) approves the payment. Never a guess: a field that
 * is not clearly printed stays null.
 */
export type VoucherApp = "yape" | "plin" | "transferencia";

export interface VoucherReading {
  app: VoucherApp | null;
  /** In cents, only when every amount printed on the voucher is the same. */
  monto: number | null;
  candidatos: number[];
  operacion: string | null;
  destinatario: string | null;
  /** YYYY-MM-DD as printed (Peru time on the phone). */
  fecha: string | null;
  /** Yape's 3-digit security code: the receiver sees the same code in their Yape. */
  codigoSeguridad: string | null;
  moneda: "PEN" | "USD" | null;
  advertencias: string[];
}

const MONTHS: Record<string, number> = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5,
  jun: 6, junio: 6, jul: 7, julio: 7, ago: 8, agosto: 8, set: 9, sep: 9, sept: 9, setiembre: 9,
  septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};
// Lines that print money that is not the payment: fees, balances, limits.
const NOT_THE_PAYMENT = /comisi[oó]n|saldo|disponible|l[ií]mite|m[aá]ximo|cashback|puntos/i;
const LABEL_WORDS = /(?:^|[^\p{L}])(?:yape|yapeaste|plin|plineaste|fecha|hora|operaci[oó]n|c[oó]digo|destino|celular|datos|enviaste|pagaste|exitos[ao]|transacci[oó]n|n[uú]mero|cuenta|monto|importe|comisi[oó]n|para|mensaje|descripci[oó]n|compartir|constancia|seguridad|interbank|bbva|scotiabank|bcp|banco)(?![\p{L}])/iu;

export function voucherCents(raw: string): number | null {
  const token = raw.replace(/\s/g, "");
  const match = token.match(/^(\d{1,3}(?:[.,]\d{3})+|\d+)(?:[.,](\d{1,2}))?$/);
  if (!match) return null;
  const value = Number(match[1].replace(/[.,]/g, "")) * 100 + (match[2] ? Number(match[2].padEnd(2, "0")) : 0);
  return Number.isSafeInteger(value) && value > 0 && value <= 999_999_999 ? value : null;
}

const AMOUNT = String.raw`(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)`;
// "S/", "S/." and the usual OCR misreads of a large "S/" ("5/", "s/").
// The lookahead keeps dates such as "5/10/2026" from reading as S/ 10.
const SOLES = new RegExp(String.raw`(?:^|[^\p{L}\d])[S5s]\s*\/\s*\.?\s*${AMOUNT}(?![\d.,/]*\d)`, "gu");
const SOLES_ALONE = /^[S5s]\s*\/\s*\.?$/;

function isoDate(year: number, month: number, day: number) {
  if (year < 100) year += 2000;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return date.toISOString().slice(0, 10);
}

function readDate(text: string) {
  const numeric = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})\b/);
  if (numeric) return isoDate(Number(numeric[3]), Number(numeric[2]), Number(numeric[1]));
  const named = text.match(/\b(\d{1,2})\s*(?:de\s+)?([a-záéíóú]{3,10})\.?\s*(?:de[l]?\s+)?,?\s*(\d{4})\b/i);
  const month = named && MONTHS[named[2].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")];
  return named && month ? isoDate(Number(named[3]), month, Number(named[1])) : null;
}

function cleanName(value: string | undefined) {
  const name = (value || "").replace(/^[:\-–\s]+/, "").replace(/\s+/g, " ").trim();
  if (!/^\p{L}[\p{L}.*'\s-]{1,79}$/u.test(name) || (name.match(/\p{L}/gu) || []).length < 2) return null;
  if (LABEL_WORDS.test(name)) return null;
  return name.slice(0, 80);
}

function readRecipient(lines: string[], amountLine: number) {
  for (let index = 0; index < lines.length; index++) {
    const labelled = lines[index].match(/^(?:para|destinatario|beneficiario|enviado\s+a|a\s+nombre\s+de|nombre\s+del\s+destinatario)\s*:?\s*(.*)$/i);
    if (labelled) {
      const name = cleanName(labelled[1]) ?? cleanName(lines[index + 1]);
      if (name) return name;
    }
    // BBVA / bank style: "Enviaste S/ 18.50" then "a María López".
    const toName = lines[index].match(/^[aA]\s+(\p{Lu}.*)$/u);
    if (toName && cleanName(toName[1])) return cleanName(toName[1]);
  }
  // Yape prints the name right under the amount.
  if (amountLine >= 0) return cleanName(lines[amountLine + 1]);
  return null;
}

function readApp(text: string): VoucherApp | null {
  if (/yapeaste|yapeo|\byape\b.*\benviaste\b/i.test(text)) return "yape";
  if (/plineaste|\bcon\s+plin\b/i.test(text)) return "plin";
  const yape = /yape/i.test(text);
  const plin = /plin/i.test(text);
  // Yape and Plin interoperate: a Yape voucher can say "Destino Plin". "Yape" first wins then.
  if (yape && plin) return /destino\s*:?\s*plin/i.test(text) ? "yape" : null;
  if (yape) return "yape";
  if (plin) return "plin";
  if (/transferencia|\bcci\b|cuenta\s+(?:de\s+)?destino/i.test(text)) return "transferencia";
  return null;
}

function readOperation(lines: string[]) {
  const label = /(?:n(?:ro|[°º]|o|[uú]mero)?\.?\s*(?:de\s+)?operaci[oó]n|c[oó]d(?:igo|\.)?\s*(?:de\s+)?operaci[oó]n|operaci[oó]n\s*(?:n[°º]|nro\.?)?)\s*[:#]?\s*(.*)$/i;
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(label);
    if (!match) continue;
    for (const candidate of [match[1], lines[index + 1] || ""]) {
      const digits = candidate.match(/^[\s#:]*([0-9][0-9\s-]{3,28})\s*$/)?.[1].replace(/\D/g, "");
      if (digits && digits.length >= 4 && digits.length <= 20) return digits;
    }
  }
  return null;
}

function readSecurityCode(lines: string[]) {
  for (let index = 0; index < lines.length; index++) {
    const match = lines[index].match(/c[oó]digo\s+de\s+seguridad\s*:?\s*(.*)$/i);
    if (!match) continue;
    for (const candidate of [match[1], lines[index + 1] || ""]) {
      const digits = candidate.match(/^\s*((?:\d\s*){3})\s*$/)?.[1].replace(/\s/g, "");
      if (digits) return digits;
    }
  }
  return null;
}

export function readVoucher(text: string, today = new Date()): VoucherReading {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const advertencias: string[] = [];
  const usd = /\bUSD\b|US\s?\$|d[oó]lares/i.test(text);
  const amounts: number[] = [];
  let amountLine = -1;
  lines.forEach((line, index) => {
    if (NOT_THE_PAYMENT.test(line)) return;
    const found: number[] = [];
    let last = index;
    for (const match of line.matchAll(SOLES)) {
      const cents = voucherCents(match[1]);
      if (cents) found.push(cents);
    }
    // A big "S/" printed apart from the number.
    if (!found.length && SOLES_ALONE.test(line)) {
      const cents = voucherCents((lines[index + 1] || "").match(new RegExp(`^${AMOUNT}$`))?.[1] || "");
      if (cents) { found.push(cents); last = index + 1; }
    }
    if (found.length && amountLine < 0) amountLine = last;
    amounts.push(...found);
  });
  const candidatos = [...new Set(amounts)].slice(0, 6);
  const moneda = usd ? "USD" : candidatos.length ? "PEN" : null;
  let monto: number | null = null;
  if (usd) advertencias.push("El comprobante parece estar en dólares. JUNTO registra pagos en soles: escribe el monto en soles.");
  else if (candidatos.length === 1) monto = candidatos[0];
  else if (candidatos.length > 1) advertencias.push("Vimos más de un monto. Elige el que pagaste.");
  else advertencias.push("No pudimos leer el monto. Escríbelo tal como aparece en el comprobante.");

  const fecha = readDate(text);
  if (fecha) {
    const days = Math.floor((Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - Date.parse(`${fecha}T00:00:00Z`)) / 86_400_000);
    if (days < -1) advertencias.push("La fecha del comprobante es posterior a hoy. Revísala.");
    else if (days > 45) advertencias.push(`El comprobante es de hace ${days} días. Revisa que sea el pago correcto.`);
  }
  return {
    app: readApp(text),
    monto,
    candidatos,
    operacion: readOperation(lines),
    destinatario: readRecipient(lines, amountLine),
    fecha,
    codigoSeguridad: readSecurityCode(lines),
    moneda,
    advertencias,
  };
}

const normalized = (value: string) =>
  value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z\s.*]/g, " ");

/**
 * Who the voucher seems to be for, among the group members. Yape abbreviates names ("Ana M. Torres"),
 * so initials count half. Only an unambiguous best match is suggested; the payer always confirms.
 */
export function matchRecipient(name: string | null, people: { id: string; nombre: string }[]) {
  if (!name) return null;
  const read = normalized(name).split(/[\s.*]+/).filter(Boolean);
  const scores = people.map((person) => {
    const tokens = normalized(person.nombre).split(/[\s.*]+/).filter(Boolean);
    const used = new Set<number>();
    let words = 0;
    let initials = 0;
    // Whole words first, so an initial cannot take the token a word needs.
    for (const token of [...read].sort((a, b) => b.length - a.length)) {
      const at = tokens.findIndex((candidate, index) =>
        !used.has(index) && (token.length === 1 ? candidate.startsWith(token) : candidate.length >= 2 && (candidate.startsWith(token) || (candidate.length >= 3 && token.startsWith(candidate)))));
      if (at < 0) continue;
      used.add(at);
      if (token.length === 1) initials += 0.5;
      else words += 1;
    }
    // An initial alone ("M.") says nothing: it only adds to a name that already matched.
    return { id: person.id, score: words ? words + initials : 0 };
  }).sort((a, b) => b.score - a.score);
  const [best, second] = scores;
  if (!best || best.score < 1) return null;
  const runnerUp = second?.score ?? 0;
  return best.score > runnerUp && (best.score >= 2 || runnerUp === 0) ? best.id : null;
}
