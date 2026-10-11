import { createHash, randomBytes } from "crypto";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { calculateQuickBill, quickBillProgress, type QuickBillInput } from "@junto/shared/quickBill";
import { prisma } from "../lib/prisma";
import { transactionLock } from "../lib/transactionLock";
import { UserError } from "../domain/errors";
import { quickBillReadSchema, quickBillWriteSchema } from "../schemas/quickBill.schema";
import { crearSinCuenta } from "./integrantes.service";

export const identitySchema = z.object({
  pagador: z.string().min(1).max(80), // "$yo" or a participant ID; never infer identity from a name.
  miParte: z.string().max(80).nullable(),
}).strict();
export const draftImportSchema = identitySchema.extend({
  datos: quickBillWriteSchema,
  solicitudId: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
}).strict();
export const historicalImportSchema = identitySchema.extend({ version: z.number().int().positive() }).strict();
type Identity = z.infer<typeof identitySchema>;
const fingerprint = (input: unknown) => createHash("sha256").update(JSON.stringify(input)).digest("hex");

async function makeGroup(tx: Prisma.TransactionClient, ownerId: string, datos: QuickBillInput, identity: Identity, request: string, hash: string, aportes: Record<string, number> = {}, recibidos: string[] = []) {
  let result: ReturnType<typeof calculateQuickBill>;
  let progress: ReturnType<typeof quickBillProgress>;
  try { result = calculateQuickBill(datos); progress = quickBillProgress(datos, aportes, recibidos); }
  catch (error) { throw new UserError((error as Error).message); }
  const ids = new Set(result.partes.map((p) => p.id));
  if (identity.miParte !== null && !ids.has(identity.miParte)) throw new UserError("Elige tu nombre en el reparto o «No estoy en la lista».");
  if (identity.pagador !== "$yo" && !ids.has(identity.pagador)) throw new UserError("Elige quién adelantó el dinero.");
  const group = await tx.grupo.create({ data: {
    nombre: datos.nombre, creadoPor: ownerId, tipo: "amigos", linkInvitacion: randomBytes(12).toString("base64url"),
    solicitudImportacion: request, importacionHuella: hash,
    miembros: { create: { usuarioId: ownerId, rol: "admin" } },
  } });
  const otherParts = result.partes.filter((p) => p.id !== identity.miParte);
  // A historical name may coincide with the organizer's name without being that person.
  const named = await crearSinCuenta(tx, group.id, otherParts.map((p) => p.nombre), true);
  const mapping = new Map(otherParts.map((p, i) => [p.id, named[i].id]));
  if (identity.miParte !== null) mapping.set(identity.miParte, ownerId);
  const payerId = identity.pagador === "$yo" ? ownerId : mapping.get(identity.pagador)!;
  await tx.gasto.create({ data: {
    grupoId: group.id, creadoPor: ownerId, pagadoPor: payerId, descripcion: datos.nombre,
    montoTotal: result.montoTotal, categoria: "otro",
    notas: ["Reparto conservado al pasar a grupo.", datos.instrucciones].filter(Boolean).join("\n"),
    participantes: { create: result.partes.filter((p) => p.total > 0).map((p) => ({ usuarioId: mapping.get(p.id)!, montoAsignado: p.total })) },
  } });
  for (const part of result.partes) {
    const amount = progress.aportes[part.id] || 0;
    const debtorId = mapping.get(part.id)!;
    // The payer already covered their own share; never fabricate a self-payment.
    if (!amount || debtorId === payerId) continue;
    await tx.pago.create({ data: {
      grupoId: group.id, pagadorId: debtorId, receptorId: payerId, monto: amount, estado: "exitoso",
      resueltoPor: ownerId, fechaResolucion: new Date(), nota: "Pago confirmado en la cuenta anterior", feejunto: 0,
    } });
  }
  return { grupoId: group.id };
}

async function activeOwner(tx: Prisma.TransactionClient, ownerId: string) {
  await transactionLock(tx, `account-membership:${ownerId}`);
  if (!(await tx.usuario.count({ where: { id: ownerId, activo: true, sinCuenta: false } }))) throw new UserError("Tu cuenta ya no está activa.", 401);
}

export async function importDraft(ownerId: string, input: z.infer<typeof draftImportSchema>) {
  const hash = fingerprint(input);
  return prisma.$transaction(async (tx) => {
    await activeOwner(tx, ownerId);
    const prior = await tx.grupo.findUnique({ where: { creadoPor_solicitudImportacion: { creadoPor: ownerId, solicitudImportacion: input.solicitudId } } });
    if (prior) {
      if (prior.importacionHuella !== hash) throw new UserError("Este cálculo ya pasó a grupo con otros datos. Abre el grupo creado antes de corregirlo.", 409);
      return { grupoId: prior.id };
    }
    return makeGroup(tx, ownerId, input.datos, input, input.solicitudId, hash);
  });
}

export async function importHistorical(ownerId: string, id: string, input: z.infer<typeof historicalImportSchema>) {
  const hash = fingerprint(input);
  return prisma.$transaction(async (tx) => {
    await activeOwner(tx, ownerId);
    await tx.$queryRaw`SELECT id FROM cuentas_rapidas WHERE id = ${id}::uuid AND creado_por = ${ownerId}::uuid FOR UPDATE`;
    const row = await tx.cuentaRapida.findFirst({ where: { id, creadoPor: ownerId } });
    if (!row) throw new UserError("No se encontró esta cuenta.", 404);
    if (row.grupoId) return { grupoId: row.grupoId };
    if (row.version !== input.version) throw new UserError("La cuenta cambió. Actualízala y revisa sus pagos antes de pasarla a grupo.", 409);
    const datos = quickBillReadSchema.parse(row.datos);
    const result = await makeGroup(tx, ownerId, datos, input, `anterior_${id}`, hash, row.aportes as Record<string, number>, row.recibidos as string[]);
    await tx.cuentaRapida.update({ where: { id }, data: {
      grupoId: result.grupoId, version: { increment: 1 },
      historial: [...(row.historial as Prisma.JsonArray), { evento: "pasada_a_grupo", fecha: new Date().toISOString(), grupoId: result.grupoId }],
    } });
    return result;
  });
}
