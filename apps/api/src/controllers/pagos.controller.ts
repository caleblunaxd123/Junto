import { Request, Response, NextFunction } from 'express';
import * as culqiService from '../services/culqi.service';
import { procesarPagoSchema } from '../schemas/pagos.schema';
import { reportarPagoSchema } from '../schemas/pagos.schema';
import * as pagosService from '../services/pagos.service';

export async function procesarPago(req: Request, res: Response, next: NextFunction) {
  try {
    const input = procesarPagoSchema.parse(req.body);
    const result = await culqiService.procesarPago(input, req.user!.userId);

    if (!result.exitoso) {
      res.status(402).json({ error: result.mensaje || 'Pago rechazado', pago: result.pago });
      return;
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function webhook(req: Request, res: Response, next: NextFunction) {
  try {
    const signature = req.headers['x-culqi-signature'] as string;
    const payload = JSON.stringify(req.body);

    if (!culqiService.validarWebhookCulqi(payload, signature)) {
      res.status(401).json({ error: 'Firma inválida' });
      return;
    }

    // Handle webhook events
    const event = req.body;
    if (event.type === 'charge.succeeded') {
      // Payment already handled in procesarPago, but we can log here
      console.info('[Webhook] Charge succeeded:', event.data?.object?.id);
    }

    res.json({ received: true });
  } catch (err) {
    next(err);
  }
}

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
