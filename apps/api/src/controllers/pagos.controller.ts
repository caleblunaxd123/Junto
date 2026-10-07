import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { reportarPagoSchema, subirComprobanteSchema } from '../schemas/pagos.schema';
import * as pagosService from '../services/pagos.service';
import { uploadVoucher } from '../services/vouchers.service';

const pagoId = (req: Request) => z.string().uuid().parse(req.params.id);

export async function getHistorial(req: Request, res: Response, next: NextFunction) {
  try {
    const historial = await pagosService.getHistorial(req.user!.userId);
    res.json(historial);
  } catch (err) {
    next(err);
  }
}

export async function getPago(req: Request, res: Response, next: NextFunction) {
  try {
    res.json(await pagosService.getPagoDetalle(pagoId(req), req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function getComprobante(req: Request, res: Response, next: NextFunction) {
  try {
    const image = await pagosService.getComprobanteImagen(pagoId(req), req.user!.userId);
    // Personal financial evidence: never cached by proxies or the browser.
    res.set('Cache-Control', 'private, no-store');
    res.json(image);
  } catch (err) {
    next(err);
  }
}

export async function subirComprobante(req: Request, res: Response, next: NextFunction) {
  try {
    const input = subirComprobanteSchema.parse(req.body);
    res.status(201).json(await uploadVoucher(req.user!.userId, input));
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
    const pago = await pagosService.resolverPago(pagoId(req), req.user!.userId, true);
    res.json(pago);
  } catch (err) {
    next(err);
  }
}

export async function rechazarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const pago = await pagosService.resolverPago(pagoId(req), req.user!.userId, false);
    res.json(pago);
  } catch (err) {
    next(err);
  }
}
