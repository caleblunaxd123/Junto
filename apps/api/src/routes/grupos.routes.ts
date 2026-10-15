import { Router } from "express";
import * as gruposController from "../controllers/grupos.controller";
import * as gastosController from "../controllers/gastos.controller";
import * as recordatoriosController from "../controllers/recordatorios.controller";
import { authMiddleware } from "../middleware/auth";
import { z } from "zod";
import { getGroupChat, groupPresence } from "../services/groupChat.service";
import { groupStatement } from "../services/statement.service";
import { fijarPresupuesto, mesSchema, presupuestoDelMes, presupuestoSchema } from "../services/presupuesto.service";
import { actualizarRecurrente, actualizarRecurrenteSchema, crearRecurrente, crearRecurrenteSchema, eliminarRecurrente, listarRecurrentes } from "../services/recurrentes.service";
import { statementPdf, statementXlsx } from "../services/statementExport.service";
import { createComment, pinMessage } from "../services/comentarios.service";
import { agregarIntegrantes, quitarIntegrante, unirIntegrante } from "../services/integrantes.service";
import { draftImportSchema, importDraft } from "../services/groupImport.service";
import { changeGroupLifecycle, archiveGroup } from '../services/groupLifecycle.service';
import { groupHistory, historyQuery } from '../services/groupHistory.service';

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
router.post('/:id/ciclo', async (req, res, next) => {
  try {
    const { accion } = z.object({ accion: z.enum(['cerrar', 'reabrir', 'eliminar-vacio']) }).strict().parse(req.body);
    res.json(await changeGroupLifecycle(z.string().uuid().parse(req.params.id), req.user!.userId, accion));
  } catch (error) { next(error); }
});
router.put('/:id/archivo', async (req, res, next) => {
  try {
    const { archivar } = z.object({ archivar: z.boolean() }).strict().parse(req.body);
    res.json(await archiveGroup(z.string().uuid().parse(req.params.id), req.user!.userId, archivar));
  } catch (error) { next(error); }
});
router.get('/:id/movimientos', async (req, res, next) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    res.json(await groupHistory(req.user!.userId, z.string().uuid().parse(req.params.id), historyQuery.parse(req.query)));
  } catch (error) { next(error); }
});
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
// The viewer's own notebook, reconciled with the group's current settlement plan.
// Household budget: the month at a glance and setting a monthly limit per category.
router.get("/:id/presupuesto", async (req, res, next) => {
  try { res.set("Cache-Control", "private, no-store"); res.json(await presupuestoDelMes(z.string().uuid().parse(req.params.id), req.user!.userId, mesSchema.parse(req.query.mes))); }
  catch (error) { next(error); }
});
router.put("/:id/presupuesto", async (req, res, next) => {
  try { res.json(await fijarPresupuesto(z.string().uuid().parse(req.params.id), presupuestoSchema.parse(req.body), req.user!.userId)); }
  catch (error) { next(error); }
});
// Recurring expenses (rent, internet…): program, list, pause/resume, stop.
router.post("/:id/recurrentes", async (req, res, next) => {
  try { res.status(201).json(await crearRecurrente(z.string().uuid().parse(req.params.id), crearRecurrenteSchema.parse(req.body), req.user!.userId)); }
  catch (error) { next(error); }
});
router.get("/:id/recurrentes", async (req, res, next) => {
  try { res.set("Cache-Control", "private, no-store"); res.json(await listarRecurrentes(z.string().uuid().parse(req.params.id), req.user!.userId)); }
  catch (error) { next(error); }
});
router.patch("/:id/recurrentes/:rid", async (req, res, next) => {
  try { res.json(await actualizarRecurrente(z.string().uuid().parse(req.params.rid), actualizarRecurrenteSchema.parse(req.body), req.user!.userId)); }
  catch (error) { next(error); }
});
router.delete("/:id/recurrentes/:rid", async (req, res, next) => {
  try { await eliminarRecurrente(z.string().uuid().parse(req.params.rid), req.user!.userId); res.status(204).send(); }
  catch (error) { next(error); }
});
router.get("/:id/estado-cuenta", async (req, res, next) => {
  try {
    res.set("Cache-Control", "private, no-store");
    res.json(await groupStatement(req.user!.userId, z.string().uuid().parse(req.params.id)));
  } catch (error) { next(error); }
});
router.get("/:id/estado-cuenta/archivo", async (req, res, next) => {
  try {
    const { formato, version, zona } = z.object({ formato: z.enum(['pdf', 'xlsx']), version: z.string().regex(/^[a-f0-9]{64}$/), zona: z.string().max(80).refine(value => { try { new Intl.DateTimeFormat('es', { timeZone: value }); return true; } catch { return false; } }, 'Zona horaria inválida').default('America/Lima') }).parse(req.query);
    const statement = await groupStatement(req.user!.userId, z.string().uuid().parse(req.params.id));
    if (statement.version !== version) { res.status(409).json({ error: 'Las cuentas cambiaron. Actualiza el cuaderno y revisa los montos antes de exportar.' }); return; }
    if (statement.movimientos.length > 5000) { res.status(413).json({ error: 'Este cuaderno es demasiado grande para exportarlo de una sola vez.' }); return; }
    const buffer = formato === 'pdf' ? await statementPdf(statement, zona) : await statementXlsx(statement, zona);
    res.set({ 'Cache-Control': 'private, no-store', 'Content-Type': formato === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="junto-cuentas.${formato}"` });
    res.send(buffer);
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
    const { texto, respondeA } = z.object({ texto: z.string().max(2000), respondeA: z.string().uuid().optional() }).strict().parse(req.body);
    const result = await createComment(req.user!.userId, { grupoId: z.string().uuid().parse(req.params.id), texto, respondeA });
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
