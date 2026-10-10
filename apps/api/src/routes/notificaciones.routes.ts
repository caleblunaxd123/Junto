import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { myGroupNotices, readGroupNotice } from "../services/groupNotices.service";

const router = Router();
router.use(authMiddleware);
router.get("/", async (req, res, next) => {
  try { res.json(await myGroupNotices(req.user!.userId)); } catch (error) { next(error); }
});
router.post("/:id/leida", async (req, res, next) => {
  try { res.json(await readGroupNotice(req.user!.userId, z.string().uuid().parse(req.params.id))); } catch (error) { next(error); }
});
export default router;
