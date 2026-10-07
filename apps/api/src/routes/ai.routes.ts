import { Router } from 'express';
import { interpretarGastoController } from '../controllers/ai.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);
router.post('/gastos/interpretar', interpretarGastoController);

export default router;
