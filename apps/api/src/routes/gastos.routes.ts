import { Router } from 'express';
import * as gastosController from '../controllers/gastos.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.get('/:id', gastosController.getGasto);
router.put('/:id', gastosController.editarGasto);
router.delete('/:id', gastosController.eliminarGasto);
router.post('/:id/foto', gastosController.subirFoto);

export default router;
