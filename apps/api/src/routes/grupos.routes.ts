import { Router } from 'express';
import * as gruposController from '../controllers/grupos.controller';
import * as gastosController from '../controllers/gastos.controller';
import * as recordatoriosController from '../controllers/recordatorios.controller';
import { authMiddleware } from '../middleware/auth';

const router = Router();

router.use(authMiddleware);

router.post('/', gruposController.crearGrupo);
router.get('/', gruposController.getGrupos);
router.get('/:id', gruposController.getGrupo);
router.get('/:id/saldos', gruposController.getSaldos);
router.post('/:id/invitar', gruposController.invitar);
router.post('/unirse', gruposController.unirse);
router.delete('/:id/salir', gruposController.salir);

// Gastos nested under grupo
router.post('/:grupoId/gastos', gastosController.crearGasto);
router.get('/:grupoId/gastos', gastosController.getGastos);

// Recordatorios nested under grupo
router.post('/:grupoId/recordar', recordatoriosController.recordar);
router.post('/:grupoId/recordatorio-automatico', recordatoriosController.configurarAutomatico);
router.get('/:grupoId/recordatorios', recordatoriosController.getHistorial);

export default router;
