export type CurrencyCode = "PEN" | "COP" | "USD" | "EUR" | "MXN" | "BRL";
export type CountryCode = "PE" | "CO" | "US" | "ES" | "MX" | "BR" | "OTHER";
export const currencies: { code: CurrencyCode; name: string; symbol: string }[];
export const countries: { code: CountryCode; name: string; currency: CurrencyCode | null }[];
export function currencyInfo(code?: CurrencyCode | string): { code: CurrencyCode; name: string; symbol: string };
export function formatMoney(minor: number, code?: CurrencyCode | string): string;
export type PaymentConversion = { monedaOrigen: CurrencyCode; montoOrigen: number; tipoCambio: string; cotizacionId?: string };
export function convertPayment(input: PaymentConversion, target: CurrencyCode | string): PaymentConversion & { monto: number };
