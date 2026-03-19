import { Request, Response, NextFunction } from 'express';
import * as recordatoriosService from '../services/recordatorios.service';
import { z } from 'zod';

const recordarSchema = z.object({
  deudorId: z.string().uuid(),
  tono: z.enum(['suave', 'directo', 'urgente']).default('suave'),
});

const configSchema = z.object({
  frecuenciaDias: z.number().int().min(1).max(30).default(7),
  activo: z.boolean().default(true),
});

export async function recordar(req: Request, res: Response, next: NextFunction) {
  try {
    const { deudorId, tono } = recordarSchema.parse(req.body);
    const recordatorio = await recordatoriosService.enviarRecordatorio(
      req.user!.userId,
      deudorId,
      req.params.grupoId,
      tono
    );
    res.status(201).json(recordatorio);
  } catch (err) {
    next(err);
  }
}

export async function configurarAutomatico(req: Request, res: Response, next: NextFunction) {
  try {
    const { frecuenciaDias, activo } = configSchema.parse(req.body);
    const config = await recordatoriosService.configurarRecordatorioAutomatico(
      req.params.grupoId,
      req.user!.userId,
      frecuenciaDias,
      activo
    );
    res.json(config);
  } catch (err) {
    next(err);
  }
}

export async function getHistorial(req: Request, res: Response, next: NextFunction) {
  try {
    const { deudorId } = z.object({ deudorId: z.string().uuid() }).parse(req.query);
    const historial = await recordatoriosService.getHistorialRecordatorios(
      deudorId,
      req.user!.userId,
      req.params.grupoId
    );
    res.json(historial);
  } catch (err) {
    next(err);
  }
}
