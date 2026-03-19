import { Router } from 'express';
import * as pagosController from '../controllers/pagos.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// Webhook no necesita auth, pero valida firma de Culqi
router.post('/webhook', pagosController.webhook);

router.use(authMiddleware);
router.post('/procesar', pagosController.procesarPago);
router.get('/historial', pagosController.getHistorial);

export default router;
