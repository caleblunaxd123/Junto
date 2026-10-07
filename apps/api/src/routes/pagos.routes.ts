import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
// Junto registra pagos hechos fuera de la app; el receptor (o el administrador, si el grupo lo
// permite) los confirma. JUNTO no cobra: no hay pasarela de pago ni webhooks de cobro.
router.post('/reportar', pagosController.reportarPago);
router.post('/comprobantes', pagosController.subirComprobante);
router.get('/historial', pagosController.getHistorial);
router.get('/:id', pagosController.getPago);
router.get('/:id/comprobante', pagosController.getComprobante);
router.post('/:id/confirmar', pagosController.confirmarPago);
router.post('/:id/rechazar', pagosController.rechazarPago);

export default router;
