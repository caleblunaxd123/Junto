export function parseMoney(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d{1,7}(?:\.\d{0,2})?$/.test(normalized)) return null;
  const [whole, decimal = ""] = normalized.split(".");
  return Number(whole) * 100 + Number(decimal.padEnd(2, "0"));
}
export function parsePercentage(text: string): number | null {
  const normalized = text.trim().replace(",", ".");
  if (!/^\d{1,3}(?:\.\d{0,2})?$/.test(normalized)) return null;
  const value = Number(normalized);
  return value <= 100 ? value : null;
}
export function allocatePreview(total: number, weights: number[]): number[] {
  if (
    !Number.isSafeInteger(total) ||
    total < 0 ||
    !weights.length ||
    weights.some((w) => !Number.isFinite(w) || w < 0) ||
    weights.reduce((a, b) => a + b, 0) <= 0
  )
    return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const raw = weights.map((w) => (total * w) / sum);
  const result = raw.map(Math.floor);
  const order = raw
    .map((v, index) => ({ index, remainder: v - result[index] }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  const remainder = total - result.reduce((a, b) => a + b, 0);
  for (let i = 0; i < remainder; i++) result[order[i].index]++;
  return result;
}
