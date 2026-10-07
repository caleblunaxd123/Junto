import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
// Junto registra pagos hechos fuera de la app; el receptor los confirma.
// JUNTO no cobra: no hay pasarela de pago ni webhooks de cobro.
router.post('/reportar', pagosController.reportarPago);
router.post('/:id/confirmar', pagosController.confirmarPago);
router.post('/:id/rechazar', pagosController.rechazarPago);
router.get('/historial', pagosController.getHistorial);

export default router;
