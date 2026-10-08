import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { answerInvitation, myInvitations } from "../services/invitaciones.service";

const router = Router();
router.use(authMiddleware);

router.get("/", async (req, res, next) => {
  try { res.json(await myInvitations(req.user!.userId)); } catch (error) { next(error); }
});
router.post("/:id/aceptar", async (req, res, next) => {
  try { res.json(await answerInvitation(req.user!.userId, z.string().uuid().parse(req.params.id), true)); } catch (error) { next(error); }
});
router.post("/:id/rechazar", async (req, res, next) => {
  try { res.json(await answerInvitation(req.user!.userId, z.string().uuid().parse(req.params.id), false)); } catch (error) { next(error); }
});

export default router;
