export interface AiMember {
  id: string;
  nombre: string;
}

export type ExpenseCategory =
  | 'comida'
  | 'transporte'
  | 'entretenimiento'
  | 'alojamiento'
  | 'compras'
  | 'otro';

export function normalizePersonName(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('es-PE')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchMemberId(
  proposedName: string,
  members: AiMember[],
  currentUserId: string
): string | null {
  const normalized = normalizePersonName(proposedName);
  if (['yo', 'mi', 'me', 'mio', 'mia'].includes(normalized)) return currentUserId;

  const exact = members.filter((member) => normalizePersonName(member.nombre) === normalized);
  if (exact.length === 1) return exact[0].id;

  const firstName = normalized.split(' ')[0];
  const byFirstName = members.filter(
    (member) => normalizePersonName(member.nombre).split(' ')[0] === firstName
  );
  return byFirstName.length === 1 ? byFirstName[0].id : null;
}

function currencyTokenToCents(rawToken: string): number | null {
  const token = rawToken.replace(/\s/g, '');
  const lastComma = token.lastIndexOf(',');
  const lastDot = token.lastIndexOf('.');
  const separatorIndex = Math.max(lastComma, lastDot);

  let normalized = token;
  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? /\./g : /,/g;
    normalized = token.replace(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else if (separatorIndex >= 0) {
    const decimals = token.length - separatorIndex - 1;
    normalized = decimals >= 1 && decimals <= 2
      ? `${token.slice(0, separatorIndex).replace(/[.,]/g, '')}.${token.slice(separatorIndex + 1)}`
      : token.replace(/[.,]/g, '');
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

/**
 * Currency values are factual data, so prefer an explicit amount written by the
 * user over an LLM reconstruction. Numbers without a currency marker are
 * intentionally ignored because they may be dates or participant counts.
 */
export function extractExplicitAmountCents(text: string): number | null {
  const prefix = text.match(/(?:s\s*\/\s*\.?|pen)\s*(\d[\d.,\s]*)/i)?.[1];
  const suffix = text.match(/(\d[\d.,\s]*)\s*(?:sol(?:es)?|pen)\b/i)?.[1];
  const token = (prefix || suffix)?.trim();
  return token ? currencyTokenToCents(token) : null;
}

export function extractLikelyAmountCents(text: string): number | null {
  const explicit = extractExplicitAmountCents(text);
  if (explicit) return explicit;

  const normalized = normalizePersonName(text);
  if (!/\b(?:pague|pago|gaste|gasto|costo|salio)\b/.test(normalized)) return null;
  const numericTokens = text.match(/\d+(?:[.,]\d{1,2})?/g) || [];
  if (numericTokens.length !== 1) return null;
  return currencyTokenToCents(numericTokens[0]);
}

const CATEGORY_KEYWORDS: Array<[ExpenseCategory, RegExp]> = [
  ['comida', /\b(?:comida|cena|almuerzo|desayuno|restaurante|ceviche|pizza|hamburguesa|delivery)\b/i],
  ['transporte', /\b(?:taxi|uber|cabify|bus|pasaje|gasolina|combustible|peaje|movilidad|transporte)\b/i],
  ['alojamiento', /\b(?:hotel|hostal|hospedaje|airbnb|alojamiento)\b/i],
  ['entretenimiento', /\b(?:cine|entrada|concierto|discoteca|juego|diversi[oó]n|entretenimiento)\b/i],
  ['compras', /\b(?:compra|compras|ropa|regalo|farmacia|supermercado)\b/i],
];

export function inferExpenseCategory(
  text: string,
  fallback: ExpenseCategory
): ExpenseCategory {
  return CATEGORY_KEYWORDS.find(([, pattern]) => pattern.test(text))?.[0] || fallback;
}

export function isFirstPersonPayer(text: string): boolean {
  return /\b(?:yo\s+)?pague\b/.test(normalizePersonName(text));
}

export function inferPayerId(
  text: string,
  members: AiMember[],
  currentUserId: string
): string | null {
  const normalizedText = ` ${normalizePersonName(text)} `;
  if (/\b(?:yo\s+)?pague\b/.test(normalizedText)) return currentUserId;

  const firstNameCounts = new Map<string, number>();
  for (const member of members) {
    const firstName = normalizePersonName(member.nombre).split(' ')[0];
    firstNameCounts.set(firstName, (firstNameCounts.get(firstName) || 0) + 1);
  }

  const matches = members.filter((member) => {
    const fullName = normalizePersonName(member.nombre);
    const firstName = fullName.split(' ')[0];
    return normalizedText.includes(` ${fullName} pago `) ||
      (firstNameCounts.get(firstName) === 1 && normalizedText.includes(` ${firstName} pago `));
  });
  return matches.length === 1 ? matches[0].id : null;
}

export function findMentionedMemberIds(text: string, members: AiMember[]): string[] {
  const normalizedText = ` ${normalizePersonName(text)} `;
  const firstNameCounts = new Map<string, number>();
  for (const member of members) {
    const firstName = normalizePersonName(member.nombre).split(' ')[0];
    firstNameCounts.set(firstName, (firstNameCounts.get(firstName) || 0) + 1);
  }

  return members.flatMap((member) => {
    const fullName = normalizePersonName(member.nombre);
    const firstName = fullName.split(' ')[0];
    const fullNameMentioned = normalizedText.includes(` ${fullName} `);
    const uniqueFirstNameMentioned =
      firstNameCounts.get(firstName) === 1 && normalizedText.includes(` ${firstName} `);
    return fullNameMentioned || uniqueFirstNameMentioned ? [member.id] : [];
  });
}

export function inferExpenseDescription(text: string, category: ExpenseCategory): string {
  const normalized = normalizePersonName(text);
  const labels: Array<[RegExp, string]> = [
    [/\bdesayuno\b/, 'Desayuno'],
    [/\balmuerzo\b/, 'Almuerzo'],
    [/\bcena\b/, 'Cena'],
    [/\btaxi\b|\buber\b|\bcabify\b/, 'Taxi'],
    [/\bhotel\b|\bhostal\b|\bairbnb\b/, 'Alojamiento'],
    [/\bcine\b/, 'Cine'],
    [/\bsupermercado\b/, 'Supermercado'],
  ];
  const explicit = labels.find(([pattern]) => pattern.test(normalized))?.[1];
  if (explicit) return explicit;
  return {
    comida: 'Comida',
    transporte: 'Movilidad',
    entretenimiento: 'Entretenimiento',
    alojamiento: 'Alojamiento',
    compras: 'Compras',
    otro: 'Gasto',
  }[category];
}

export function buildExpenseExplanation(input: {
  concepto: string;
  totalCents: number;
  payerName: string | null;
  participantNames: string[];
}): string {
  const amount = (input.totalCents / 100).toFixed(2);
  const payer = input.payerName || 'un integrante por revisar';
  const participants = input.participantNames.length > 0
    ? input.participantNames.join(', ')
    : 'participantes por revisar';
  return `JUNTO preparó S/ ${amount} para “${input.concepto}”. Pagó ${payer} y se divide entre ${participants}.`;
}
