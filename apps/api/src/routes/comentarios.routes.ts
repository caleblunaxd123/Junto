import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { createComment, deleteComment, listComments, reportComment, type CommentTarget } from "../services/comentarios.service";

const router = Router();
router.use(authMiddleware);

// Exactly one of gastoId / pagoId.
const target = z.union([
  z.object({ gastoId: z.string().uuid(), pagoId: z.undefined().optional() }),
  z.object({ pagoId: z.string().uuid(), gastoId: z.undefined().optional() }),
]);

router.get("/", async (req, res, next) => {
  try {
    const where = target.parse({ gastoId: req.query.gastoId || undefined, pagoId: req.query.pagoId || undefined }) as CommentTarget;
    res.set("Cache-Control", "private, no-store");
    res.json(await listComments(req.user!.userId, where));
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    const body = z.object({ gastoId: z.string().uuid().optional(), pagoId: z.string().uuid().optional(), texto: z.string().max(2000) }).strict().parse(req.body);
    const where = target.parse({ gastoId: body.gastoId, pagoId: body.pagoId }) as CommentTarget;
    const result = await createComment(req.user!.userId, { ...where, texto: body.texto });
    res.status(result.repetido ? 200 : 201).json(result);
  } catch (error) { next(error); }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await deleteComment(req.user!.userId, z.string().uuid().parse(req.params.id));
    res.status(204).end();
  } catch (error) { next(error); }
});

router.post("/:id/reportar", async (req, res, next) => {
  try {
    const { motivo } = z.object({ motivo: z.string().max(200).optional() }).strict().parse(req.body ?? {});
    await reportComment(req.user!.userId, z.string().uuid().parse(req.params.id), motivo);
    res.json({ reportado: true });
  } catch (error) { next(error); }
});

export default router;
