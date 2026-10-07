import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Webhook no necesita auth, pero valida firma de Culqi
router.post('/webhook', pagosController.webhook);

router.use(authMiddleware);
// Junto registra pagos hechos fuera de la app; el receptor los confirma.
// El cobro por Culqi queda fuera de la app hasta integrar tokenización real.
router.post('/reportar', pagosController.reportarPago);
router.post('/:id/confirmar', pagosController.confirmarPago);
router.post('/:id/rechazar', pagosController.rechazarPago);
router.get('/historial', pagosController.getHistorial);

export default router;
