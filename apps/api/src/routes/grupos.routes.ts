import { Router } from "express";
import * as gruposController from "../controllers/grupos.controller";
import * as gastosController from "../controllers/gastos.controller";
import * as recordatoriosController from "../controllers/recordatorios.controller";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { getGroupChat, groupPresence } from "../services/groupChat.service";
import { createComment, pinMessage } from "../services/comentarios.service";
import { agregarIntegrantes, quitarIntegrante, unirIntegrante } from "../services/integrantes.service";
import { draftImportSchema, importDraft } from "../services/groupImport.service";

const router = Router();

router.use(authMiddleware);
router.post("/desde-reparto", async (req, res, next) => {
  try { res.status(201).json(await importDraft(req.user!.userId, draftImportSchema.parse(req.body))); }
  catch (error) { next(error); }
});

router.post("/", gruposController.crearGrupo);
router.get("/", gruposController.getGrupos);
router.get("/invitacion/:code", gruposController.invitacion);
router.get("/:id", gruposController.getGrupo);
router.put("/:id", gruposController.editarGrupo);
router.get("/:id/saldos", gruposController.getSaldos);
router.post("/:id/invitar", gruposController.invitar);
router.post("/unirse", gruposController.unirse);
router.delete("/:id/salir", gruposController.salir);
// People added by name before they have JUNTO.
router.post("/:id/integrantes", async (req, res, next) => {
  try {
    const { nombres } = z.object({ nombres: z.array(z.string().max(60)).min(1).max(30) }).strict().parse(req.body);
    res.status(201).json(await agregarIntegrantes(z.string().uuid().parse(req.params.id), req.user!.userId, nombres));
  } catch (error) { next(error); }
});
router.delete("/:id/integrantes/:integranteId", async (req, res, next) => {
  try {
    await quitarIntegrante(z.string().uuid().parse(req.params.id), req.user!.userId, z.string().uuid().parse(req.params.integranteId));
    res.status(204).end();
  } catch (error) { next(error); }
});
router.post("/:id/integrantes/:integranteId/unir", async (req, res, next) => {
  try {
    const { usuarioId } = z.object({ usuarioId: z.string().uuid() }).strict().parse(req.body);
    await unirIntegrante(z.string().uuid().parse(req.params.id), req.user!.userId, z.string().uuid().parse(req.params.integranteId), usuarioId);
    res.json({ unido: true });
  } catch (error) { next(error); }
});
// The group as a chat about money: timeline plus plain messages.
router.get("/:id/chat", async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    res.json(await getGroupChat(req.user!.userId, z.string().uuid().parse(req.params.id)));
  } catch (error) { next(error); }
});
// Who is online now, and when the others were last seen. Members only; people added by name have no presence.
router.get("/:id/presencia", async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    res.json(await groupPresence(req.user!.userId, z.string().uuid().parse(req.params.id)));
  } catch (error) { next(error); }
});
router.post("/:id/fijar", async (req, res, next) => {
  try {
    const { comentarioId } = z.object({ comentarioId: z.string().uuid().nullable() }).strict().parse(req.body ?? {});
    res.json(await pinMessage(req.user!.userId, z.string().uuid().parse(req.params.id), comentarioId));
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
