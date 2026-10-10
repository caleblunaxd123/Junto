// Deterministic, deliberately limited grammar: never let a model convert money.
const units: Record<string, number> = {
  cero:0, un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
  diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17,
  dieciocho:18, diecinueve:19, veinte:20, veintiuno:21, veintiun:21, veintidos:22,
  veintitres:23, veinticuatro:24, veinticinco:25, veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29,
};
const tens: Record<string, number> = {treinta:30, cuarenta:40, cincuenta:50, sesenta:60, setenta:70, ochenta:80, noventa:90};
const hundreds: Record<string, number> = {doscientos:200,trescientos:300,cuatrocientos:400,quinientos:500,seiscientos:600,setecientos:700,ochocientos:800,novecientos:900};
const allowed = new Set([...Object.keys(units), ...Object.keys(tens), ...Object.keys(hundreds), 'cien','ciento','mil','y']);
function small(tokens: string[]): number | null {
  if (!tokens.length) return 0;
  if (tokens.length === 1 && units[tokens[0]] !== undefined) return units[tokens[0]];
  if (tokens.length === 1 && tens[tokens[0]]) return tens[tokens[0]];
  if (tokens.length === 3 && tens[tokens[0]] && tokens[1] === 'y' && units[tokens[2]] >= 1 && units[tokens[2]] <= 9) return tens[tokens[0]] + units[tokens[2]];
  if (tokens[0] === 'cien') return tokens.length === 1 ? 100 : null;
  const base = tokens[0] === 'ciento' ? 100 : hundreds[tokens[0]];
  if (base) {
    const rest = small(tokens.slice(1));
    return rest !== null && rest < 100 && (tokens[0] !== 'ciento' || rest > 0) ? base + rest : null;
  }
  return null;
}
function integer(tokens: string[]): number | null {
  const index = tokens.indexOf('mil');
  if (index < 0) return small(tokens);
  if (tokens.lastIndexOf('mil') !== index) return null;
  const multiplier = index === 0 ? 1 : small(tokens.slice(0,index));
  const rest = small(tokens.slice(index+1));
  return multiplier !== null && multiplier > 0 && rest !== null && rest < 1000 ? multiplier*1000+rest : null;
}
export function extractSpanishAmountCents(text: string): number | null {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  // Keep punctuation boundaries: "veinte, treinta soles" must not become fifty.
  const tokens = normalized.match(/[a-z]+|\d+|[^\s\w]/g) || [];
  const positions = tokens.flatMap((token,i) => /^sol(?:es)?$/.test(token) ? [i] : []);
  if (positions.length !== 1) return null;
  const position = positions[0];
  let start = position;
  while (start > 0 && allowed.has(tokens[start-1])) start--;
  if (start === position || position-start > 10) return null;
  const whole = integer(tokens.slice(start,position));
  if (whole === null || whole < 0) return null;
  let cents = 0;
  if (tokens[position+1] === 'con') {
    let end = position+2;
    while (end < tokens.length && allowed.has(tokens[end])) end++;
    const fraction = small(tokens.slice(position+2,end));
    if (end === position+2 || !/^cent(?:imo|avo)s?$/.test(tokens[end] || '') || fraction === null || fraction >= 100) return null;
    cents = fraction;
  }
  const total = whole*100+cents;
  return Number.isSafeInteger(total) && total > 0 && total <= 999_999_999 ? total : null;
}
