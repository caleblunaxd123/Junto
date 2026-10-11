import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth';
import { z } from 'zod';
import { authRateLimit } from '../middleware/authRateLimit';
import { validPaymentDate } from '../domain/exchange';
import { paymentReference } from '../services/exchange.service';

const router = Router();

router.use(authMiddleware);
router.get('/tipo-cambio', authRateLimit, async (req, res, next) => {
  try {
    const input = z.object({ grupoId: z.string().uuid(), origen: z.enum(['PEN', 'COP', 'USD', 'EUR', 'MXN', 'BRL']), fecha: z.string().refine((date) => validPaymentDate(date), 'Elige una fecha válida que no sea futura.') }).strict().parse(req.query);
    res.set('Cache-Control', 'private, no-store').json(await paymentReference(req.user!.userId, input.grupoId, input.origen, input.fecha));
  } catch (error) { next(error); }
});
// Junto registra pagos hechos fuera de la app; el receptor (o el administrador, si el grupo lo
// permite) los confirma. JUNTO no cobra: no hay pasarela de pago ni webhooks de cobro.
router.post('/reportar', pagosController.reportarPago);
router.post('/recibido', pagosController.registrarRecibido);
router.post('/comprobantes', pagosController.subirComprobante);
router.get('/historial', pagosController.getHistorial);
router.get('/:id', pagosController.getPago);
router.get('/:id/comprobante', pagosController.getComprobante);
router.post('/:id/confirmar', pagosController.confirmarPago);
router.post('/:id/rechazar', pagosController.rechazarPago);

export default router;
