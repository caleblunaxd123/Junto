import { currencyInfo } from '@junto/shared/currency';

export function validPaymentDate(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value && value >= '2000-01-01' && value <= now.toISOString().slice(0, 10);
}
export function referenceForDate(actual: string, requested: string) {
  const age = (Date.parse(`${requested}T00:00:00Z`) - Date.parse(`${actual}T00:00:00Z`)) / 86400000;
  const date = new Date(`${actual}T00:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(actual) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === actual && age >= 0 && age <= 7;
}
/** Only a daily reference, never a bank's executed rate; no personal data in this request. */
export function createRateReader(request: typeof fetch = fetch) {
  return async (origen: string, destino: string, fecha: string) => {
    currencyInfo(origen); currencyInfo(destino);
    if (origen === destino || !validPaymentDate(fecha)) throw new Error('Par o fecha inválidos');
    const response = await request(`https://api.frankfurter.dev/v2/rate/${origen.toLowerCase()}/${destino.toLowerCase()}?date=${fecha}`, { signal: AbortSignal.timeout(6000) as NonNullable<Parameters<typeof fetch>[1]>['signal'], redirect: 'error' });
    if (!response.ok) throw new Error('Referencia no disponible');
    const data = await response.json() as { date?: string; base?: string; quote?: string; rate?: number };
    if (data.base !== origen || data.quote !== destino || !data.date || !referenceForDate(data.date, fecha) || typeof data.rate !== 'number' || !Number.isFinite(data.rate) || data.rate <= 0 || data.rate >= 1000000)
      throw new Error('Referencia inválida o demasiado antigua');
    // The same six-decimal rate is displayed and applied, never hidden precision.
    const tasa = data.rate.toFixed(6).replace(/0+$/, '').replace(/\.$/, '');
    if (Number(tasa) <= 0) throw new Error('Referencia fuera del rango permitido');
    return { origen, destino, fecha: data.date, tasa, fuente: 'Frankfurter · referencia diaria combinada' };
  };
}
