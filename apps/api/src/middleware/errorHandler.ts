import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { UserError } from '../domain/errors';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof UserError) { res.status(err.status).json({ error: err.message, code: err.code }); return; }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: 'Datos inválidos',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  console.error('[Error]', err.message, err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
}
