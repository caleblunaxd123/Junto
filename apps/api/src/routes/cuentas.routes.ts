import { Router } from "express";
import { z } from "zod";
import { calculateQuickBill, quickBillMessage, quickBillBrief, quickBillProgress, QuickBillInput } from "@junto/shared/quickBill";
import type { CuentaRapida } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authMiddleware } from "../middleware/auth";
import { UserError } from "../domain/errors";
import { readReceipt } from "../services/receipt.service";
import { quickBillReadSchema as inputSchema, quickBillWriteSchema } from "../schemas/quickBill.schema";

const router = Router();
router.use(authMiddleware);
const scans = new Map<string, { count: number; until: number }>();
router.post("/leer-boleta", async (req, res, next) => {
  try {
    const now = Date.now();
    for (const [id, window] of scans) if (window.until < now) scans.delete(id);
    const window = scans.get(req.user!.userId) || { count: 0, until: now + 60_000 };
    if (window.count >= 4) throw new UserError("Puedes leer hasta 4 fotos por minuto. Espera un poco o escribe el total.", 429);
    window.count++; scans.set(req.user!.userId, window);
    const { imagen } = z.object({ imagen: z.string().min(16).max(5_600_000) }).strict().parse(req.body);
    res.json(await readReceipt(imagen));
  } catch (error) { next(error); }
});
function view(row: CuentaRapida) {
  const datos = inputSchema.parse(row.datos);
  const recibidos = row.recibidos as string[];
  const resultado = calculateQuickBill(datos);
  const progress = quickBillProgress(datos, row.aportes as Record<string, number>, recibidos);
  return { id: row.id, datos, resultado, ...progress, archivada: row.archivada, historial: row.historial, version: row.version, fechaCreacion: row.fechaCreacion, fechaActualizacion: row.fechaActualizacion, mensaje: quickBillMessage(datos, progress.recibidos), mensajeBreve: quickBillBrief(datos, progress.aportes) };
}
function history(row: CuentaRapida, evento: string, extra: Record<string, string | number | boolean> = {}) {
  return [...(row.historial as object[]), { evento, fecha: new Date().toISOString(), ...extra }];
}
async function owned(id: unknown, userId: string) {
  const row = await prisma.cuentaRapida.findFirst({ where: { id: z.string().uuid().parse(id), creadoPor: userId } });
  if (!row) throw new UserError("No se encontró esta cuenta.", 404);
  return row;
}
async function setContribution(id: unknown, userId: string, input: { participanteId: string; version: number; monto?: number; recibido?: boolean }) {
  const row = await owned(id, userId);
  if (row.version !== input.version || row.archivada) throw new UserError("La cuenta cambió o está archivada. Actualiza antes de confirmar el aporte.", 409);
  const current = view(row);
  const part = current.resultado.partes.find((p) => p.id === input.participanteId);
  if (!part || part.total <= 0) throw new UserError("Esta persona no tiene un aporte pendiente.");
  const amount = input.monto ?? (input.recibido ? part.total : 0);
  if (amount < 0 || amount > part.total) throw new UserError("El aporte no puede superar la parte de esta persona.");
  const previous = current.aportes[part.id] || 0;
  if (previous === amount) return current;
  const progress = quickBillProgress(current.datos, { ...current.aportes, [part.id]: amount });
  const changed = await prisma.cuentaRapida.updateMany({ where: { id: row.id, creadoPor: userId, version: input.version }, data: { aportes: progress.aportes, recibidos: progress.recibidos, historial: history(row, "aporte", { persona: part.nombre, anterior: previous, monto: amount }), version: { increment: 1 } } });
  if (!changed.count) throw new UserError("La cuenta cambió. Actualiza antes de confirmar el aporte.", 409);
  return view(await prisma.cuentaRapida.findUniqueOrThrow({ where: { id: row.id } }));
}
router.get("/", async (req, res, next) => {
  try { res.json((await prisma.cuentaRapida.findMany({ where: { creadoPor: req.user!.userId }, orderBy: { fechaCreacion: "desc" } })).map(view)); } catch (error) { next(error); }
});
router.get("/solicitud/:solicitudId", async (req, res, next) => {
  try {
    const solicitudId = z.string().regex(/^[A-Za-z0-9_-]{8,80}$/).parse(req.params.solicitudId);
    const row = await prisma.cuentaRapida.findUnique({ where: { creadoPor_solicitudId: { creadoPor: req.user!.userId, solicitudId } } });
    res.json(row ? view(row) : null);
  } catch (error) { next(error); }
});
router.get("/:id", async (req, res, next) => {
  try {
    const row = await prisma.cuentaRapida.findFirst({ where: { id: z.string().uuid().parse(req.params.id), creadoPor: req.user!.userId } });
    if (!row) throw new UserError("No se encontró esta cuenta.", 404);
    res.json(view(row));
  } catch (error) { next(error); }
});
router.post("/", async (req, res, next) => {
  try {
    const { solicitudId, ...datos } = quickBillWriteSchema.extend({ solicitudId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/).optional() }).parse(req.body);
    try { calculateQuickBill(datos); } catch (error) { throw new UserError((error as Error).message); }
    const creadoPor = req.user!.userId;
    const replay = async () => {
      const row = solicitudId ? await prisma.cuentaRapida.findUnique({ where: { creadoPor_solicitudId: { creadoPor, solicitudId } } }) : null;
      if (!row) return false;
      if (JSON.stringify(inputSchema.parse(row.datos)) !== JSON.stringify(datos)) throw new UserError("Esta solicitud ya guardó otra versión. Abre la cuenta guardada antes de corregirla.", 409);
      res.json(view(row)); return true;
    };
    if (await replay()) return;
    try {
      res.status(201).json(view(await prisma.cuentaRapida.create({ data: { nombre: datos.nombre, datos, creadoPor, solicitudId, historial: [{ evento: "creada", fecha: new Date().toISOString() }] } })));
    } catch (error) {
      if ((error as { code?: string }).code === "P2002" && await replay()) return;
      throw error;
    }
  } catch (error) { next(error); }
});
router.put("/:id", async (req, res, next) => {
  try {
    const { version, ...datos } = quickBillWriteSchema.extend({ version: z.number().int().positive() }).parse(req.body);
    try { calculateQuickBill(datos); } catch (error) { throw new UserError((error as Error).message); }
    const current = await owned(req.params.id, req.user!.userId);
    if (current.version === version + 1 && JSON.stringify(inputSchema.parse(current.datos)) === JSON.stringify(datos) && (current.historial as { evento: string }[]).at(-1)?.evento === "corregida") { res.json(view(current)); return; }
    if (view(current).cobrado > 0 || current.archivada) throw new UserError("Primero corrige los aportes confirmados o reactiva la cuenta. No cambiamos las partes después de recibir dinero.", 409);
    const changed = await prisma.cuentaRapida.updateMany({ where: { id: current.id, creadoPor: req.user!.userId, version }, data: { nombre: datos.nombre, datos, aportes: {}, recibidos: [], historial: history(current, "corregida", { anterior: calculateQuickBill(inputSchema.parse(current.datos)).montoTotal, monto: calculateQuickBill(datos).montoTotal }), version: { increment: 1 } } });
    if (!changed.count) throw new UserError("No se guardó: la cuenta cambió o ya tiene pagos recibidos. Actualízala antes de continuar.", 409);
    const row = await prisma.cuentaRapida.findUniqueOrThrow({ where: { id: req.params.id } });
    res.json(view(row));
  } catch (error) { next(error); }
});
router.post("/:id/recibidos", async (req, res, next) => {
  try {
    const input = z.object({ participanteId: z.string(), recibido: z.boolean(), version: z.number().int().positive() }).strict().parse(req.body);
    res.json(await setContribution(req.params.id, req.user!.userId, input));
  } catch (error) { next(error); }
});
router.post("/:id/aportes", async (req, res, next) => {
  try {
    const input = z.object({ participanteId: z.string(), monto: z.number().int().nonnegative().max(999_999_999), version: z.number().int().positive() }).strict().parse(req.body);
    res.json(await setContribution(req.params.id, req.user!.userId, input));
  } catch (error) { next(error); }
});
router.post("/:id/archivo", async (req, res, next) => {
  try {
    const input = z.object({ archivada: z.boolean(), version: z.number().int().positive() }).strict().parse(req.body);
    const row = await owned(req.params.id, req.user!.userId);
    if (input.archivada && view(row).pendiente > 0) throw new UserError("Todavía hay aportes pendientes. Completa la cuenta antes de archivarla.", 409);
    const changed = await prisma.cuentaRapida.updateMany({ where: { id: row.id, creadoPor: req.user!.userId, version: input.version }, data: { archivada: input.archivada, historial: history(row, input.archivada ? "archivada" : "reactivada"), version: { increment: 1 } } });
    if (!changed.count) throw new UserError("La cuenta cambió. Actualízala antes de continuar.", 409);
    res.json(view(await prisma.cuentaRapida.findUniqueOrThrow({ where: { id: row.id } })));
  } catch (error) { next(error); }
});
export default router;
