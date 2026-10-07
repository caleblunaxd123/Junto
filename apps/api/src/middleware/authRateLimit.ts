import { Request, Response, NextFunction } from 'express';
// Single-process guard. Use a shared Redis limiter before scaling API replicas.
const buckets = new Map<string, { count: number; expires: number }>();
export function authRateLimit(req: Request, res: Response, next: NextFunction) {
  const now = Date.now();
  if (buckets.size > 10000) for (const [key, bucket] of buckets) if (bucket.expires < now) buckets.delete(key);
  const key = `${req.ip}:${req.path}`;
  const current = buckets.get(key);
  const bucket = current && current.expires > now ? current : { count: 0, expires: now + 15 * 60_000 };
  bucket.count++; buckets.set(key, bucket);
  if (bucket.count > 30) { res.setHeader('Retry-After', Math.ceil((bucket.expires - now) / 1000)); res.status(429).json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.' }); return; }
  next();
}
