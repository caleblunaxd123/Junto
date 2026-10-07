import { Router } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth";
import { sendShareEmail, shareEmailAvailability } from "../services/shareEmail.service";

const router = Router();
router.use(authMiddleware);

/** Lets the app say upfront whether JUNTO can send the e-mail, before anyone types an address. */
router.get("/correo/estado", (_req, res) => {
  res.json(shareEmailAvailability());
});

const sendSchema = z.object({
  recurso: z.object({ tipo: z.enum(["cuenta_rapida", "grupo", "gasto"]), id: z.string().uuid() }).strict(),
  destinatario: z.string().trim().min(3).max(254),
  solicitudId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
  huella: z.string().regex(/^[0-9a-f]{16}$/),
}).strict();

// The body carries references only: no HTML, subject or amounts are accepted from the client.
router.post("/correo", async (req, res, next) => {
  try {
    const input = sendSchema.parse(req.body);
    const result = await sendShareEmail(req.user!.userId, input);
    res.status(result.estado === "aceptado" ? 202 : result.estado === "fallido" ? 502 : result.estado === "incierto" ? 504 : 409).json(result);
  } catch (error) {
    next(error);
  }
});

export default router;
