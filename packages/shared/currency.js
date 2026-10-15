"use strict";

// ISO 4217: all supported currencies have two decimal minor units. Never infer a
// travel destination from GPS, language or IP, and never convert ledger amounts.
const currencies = [
  { code: "PEN", name: "Soles", symbol: "S/" },
  { code: "COP", name: "Pesos colombianos", symbol: "COP" },
  { code: "USD", name: "Dólares estadounidenses", symbol: "US$" },
  { code: "EUR", name: "Euros", symbol: "€" },
  { code: "MXN", name: "Pesos mexicanos", symbol: "MXN" },
  { code: "BRL", name: "Reales brasileños", symbol: "R$" },
];
const countries = [
  { code: "PE", name: "Perú", currency: "PEN" },
  { code: "CO", name: "Colombia", currency: "COP" },
  { code: "US", name: "Estados Unidos", currency: "USD" },
  { code: "ES", name: "España", currency: "EUR" },
  { code: "MX", name: "México", currency: "MXN" },
  { code: "BR", name: "Brasil", currency: "BRL" },
  { code: "OTHER", name: "Otro país", currency: null },
];
function currencyInfo(code = "PEN") {
  const info = currencies.find((currency) => currency.code === code);
  if (!info) throw new Error("Moneda no admitida");
  return info;
}
// Peruvian convention, shared by every supported currency here: comma for thousands, dot for
// decimals (S/ 1,080.00). Integer arithmetic only; the value is never parsed back.
function formatMoney(minor, code = "PEN") {
  if (!Number.isSafeInteger(minor)) throw new Error("Monto inválido");
  const units = String(Math.floor(Math.abs(minor) / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const cents = String(Math.abs(minor) % 100).padStart(2, "0");
  return `${currencyInfo(code).symbol} ${minor < 0 ? "-" : ""}${units}.${cents}`;
}
// Agreed rate: target units per ONE origin unit, six decimals, half-up to a minor
// unit. Integer/BigInt arithmetic avoids binary-float or model rounding errors.
function convertPayment(input, target) {
  currencyInfo(target);
  currencyInfo(input.monedaOrigen);
  if (input.monedaOrigen === target) throw new Error("Elige una moneda distinta a la del grupo.");
  if (!Number.isSafeInteger(input.montoOrigen) || input.montoOrigen <= 0 || input.montoOrigen > 999999999)
    throw new Error("Escribe un monto válido en la moneda que pagaste.");
  const rate = String(input.tipoCambio).trim().replace(",", ".");
  if (!/^\d{1,6}(?:\.\d{1,6})?$/.test(rate)) throw new Error("Escribe un tipo de cambio positivo, con hasta 6 decimales.");
  const [whole, decimal = ""] = rate.split(".");
  const scaled = BigInt(whole) * BigInt(1000000) + BigInt(decimal.padEnd(6, "0"));
  if (scaled <= BigInt(0)) throw new Error("El tipo de cambio debe ser mayor que cero.");
  const result = (BigInt(input.montoOrigen) * scaled + BigInt(500000)) / BigInt(1000000);
  if (result <= BigInt(0) || result > BigInt(999999999)) throw new Error("El equivalente está fuera del rango permitido.");
  return { monedaOrigen: input.monedaOrigen, montoOrigen: input.montoOrigen, tipoCambio: rate, monto: Number(result) };
}
module.exports = { currencies, countries, currencyInfo, formatMoney, convertPayment };
