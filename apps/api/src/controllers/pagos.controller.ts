import { Request, Response, NextFunction } from 'express';
import { reportarPagoSchema } from '../schemas/pagos.schema';
import * as pagosService from '../services/pagos.service';

export async function getHistorial(req: Request, res: Response, next: NextFunction) {
  try {
    const historial = await pagosService.getHistorial(req.user!.userId);
    res.json(historial);
  } catch (err) {
    next(err);
  }
}

export async function reportarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const input = reportarPagoSchema.parse(req.body);
    const pago = await pagosService.reportarPago(input, req.user!.userId);
    res.status(201).json(pago);
  } catch (err) {
    next(err);
  }
}

export async function confirmarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const pago = await pagosService.resolverPago(req.params.id, req.user!.userId, true);
    res.json(pago);
  } catch (err) {
    next(err);
  }
}

export async function rechazarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const pago = await pagosService.resolverPago(req.params.id, req.user!.userId, false);
    res.json(pago);
  } catch (err) {
    next(err);
  }
}
