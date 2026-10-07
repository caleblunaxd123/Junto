import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';
import { UserError } from '../domain/errors';

type HttpishError = Error & { type?: string; status?: number; statusCode?: number };

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

  // Body-parser failures are client mistakes, not server faults.
  const http = err as HttpishError;
  if (http.type === 'entity.parse.failed') { res.status(400).json({ error: 'La solicitud no tiene un formato válido.' }); return; }
  if (http.type === 'entity.too.large') { res.status(413).json({ error: 'El contenido enviado es demasiado grande.' }); return; }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    // Two simultaneous requests creating the same unique record (e.g. e-mail on sign-up).
    if (err.code === 'P2002') { res.status(409).json({ error: 'Este registro ya existe. Actualiza e inténtalo de nuevo.' }); return; }
    // Malformed identifiers (non-UUID in a path) or rows that vanished mid-request.
    if (err.code === 'P2023' || err.code === 'P2025') { res.status(404).json({ error: 'No encontramos lo que buscas.' }); return; }
    if (err.code === 'P2010' && /22P02/.test(err.message)) { res.status(404).json({ error: 'No encontramos lo que buscas.' }); return; }
  }

  console.error('[Error]', err.message, err.stack);
  res.status(500).json({ error: 'Error interno del servidor' });
}
