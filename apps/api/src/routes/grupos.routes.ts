import { Router } from "express";
import * as gruposController from "../controllers/grupos.controller";
import * as gastosController from "../controllers/gastos.controller";
import * as recordatoriosController from "../controllers/recordatorios.controller";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { getGroupChat } from "../services/groupChat.service";
import { createComment } from "../services/comentarios.service";

const router = Router();

router.use(authMiddleware);

router.post("/", gruposController.crearGrupo);
router.get("/", gruposController.getGrupos);
router.get("/invitacion/:code", gruposController.invitacion);
router.get("/:id", gruposController.getGrupo);
router.put("/:id", gruposController.editarGrupo);
router.get("/:id/saldos", gruposController.getSaldos);
router.post("/:id/invitar", gruposController.invitar);
router.post("/unirse", gruposController.unirse);
router.delete("/:id/salir", gruposController.salir);
// The group as a chat about money: timeline plus plain messages.
router.get("/:id/chat", async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    res.json(await getGroupChat(req.user!.userId, z.string().uuid().parse(req.params.id)));
  } catch (error) { next(error); }
});
router.post("/:id/mensajes", async (req, res, next) => {
  try {
    const { texto } = z.object({ texto: z.string().max(2000) }).strict().parse(req.body);
    const result = await createComment(req.user!.userId, { grupoId: z.string().uuid().parse(req.params.id), texto });
    res.status(result.repetido ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

// Gastos nested under grupo
router.post("/:grupoId/gastos", gastosController.crearGasto);
router.get("/:grupoId/gastos", gastosController.getGastos);

// Recordatorios nested under grupo
router.post("/:grupoId/recordar", recordatoriosController.recordar);
router.post(
  "/:grupoId/recordatorio-automatico",
  recordatoriosController.configurarAutomatico,
);
router.get("/:grupoId/recordatorios", recordatoriosController.getHistorial);

router.post("/:id/miembros-bulk", gruposController.agregarMiembrosBulk);

export default router;
