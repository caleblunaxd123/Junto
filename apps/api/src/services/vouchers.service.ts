import { createHash } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { transactionLock } from "../lib/transactionLock";
import { UserError } from "../domain/errors";
import { matchRecipient, readVoucher, type VoucherReading } from "../domain/voucher";
import { decodeImage, recognizeText, PSM } from "./ocr.service";

export const VOUCHER_LIMITS = { per10Minutes: 10, perDay: 40, maxBytes: 3 * 1024 * 1024, draftHours: 24, keepImageDays: 180 };
const ACTIVE_PAYMENT = ["reportado", "exitoso"];
type Db = Prisma.TransactionClient | typeof prisma;

/** Why this voucher cannot back a new payment, or null. Rejected payments free their voucher. */
export async function voucherInUse(db: Db, voucher: { id: string; hash: string; app: string | null; operacion: string | null }) {
  const sameImage = await db.comprobante.findFirst({
    where: { id: { not: voucher.id }, hash: voucher.hash, pago: { estado: { in: ACTIVE_PAYMENT } } },
    select: { id: true },
  });
  if (sameImage) return "Este comprobante ya se usó para registrar otro pago.";
  if (voucher.operacion && voucher.operacion.length >= 6) {
    const sameOperation = await db.comprobante.findFirst({
      where: { id: { not: voucher.id }, operacion: voucher.operacion, app: voucher.app, pago: { estado: { in: ACTIVE_PAYMENT } } },
      select: { id: true },
    });
    if (sameOperation) return "Este número de operación ya está registrado en otro pago.";
  }
  return null;
}

/** Drafts nobody reported in a day, and images of payments settled long ago. Metadata stays. */
export async function purgeVouchers(now = new Date()) {
  const drafts = await prisma.comprobante.deleteMany({
    where: { pagoId: null, fechaCreacion: { lt: new Date(now.getTime() - VOUCHER_LIMITS.draftHours * 3_600_000) } },
  });
  const images = await prisma.comprobanteImagen.deleteMany({
    where: { comprobante: { pago: { estado: { not: "reportado" }, fechaResolucion: { lt: new Date(now.getTime() - VOUCHER_LIMITS.keepImageDays * 86_400_000) } } } },
  });
  return { borradores: drafts.count, imagenes: images.count };
}

async function read(buffer: Buffer): Promise<{ reading: VoucherReading | null; aviso?: string }> {
  try {
    const messages = {
      busy: "El lector está ocupado ahora.",
      timeout: "El lector tardó demasiado.",
      failed: "No pudimos leer la imagen.",
    };
    const first = await recognizeText(buffer, [PSM.AUTO], messages);
    let reading = readVoucher(first.texts[0]);
    // Large amounts in colored headers sometimes need a second, sparse pass.
    if (reading.monto === null && reading.moneda !== "USD") {
      const second = readVoucher((await recognizeText(buffer, [PSM.SPARSE_TEXT], messages)).texts[0]);
      if (second.monto !== null) {
        reading = {
          ...second,
          app: reading.app ?? second.app,
          operacion: reading.operacion ?? second.operacion,
          destinatario: reading.destinatario ?? second.destinatario,
          fecha: reading.fecha ?? second.fecha,
          codigoSeguridad: reading.codigoSeguridad ?? second.codigoSeguridad,
        };
      }
    }
    return { reading };
  } catch (error) {
    // The voucher is still attached: the payer types the amount and the approver sees the image.
    if (error instanceof UserError) return { reading: null, aviso: `${error.message} Igual adjuntamos la imagen: escribe el monto.` };
    throw error;
  }
}

/**
 * Stores a voucher as a draft and proposes what it says. Nothing is reported until the payer
 * confirms; whoever approves sees the same image.
 */
export async function uploadVoucher(userId: string, input: { grupoId: string; imagen: string }) {
  const member = await prisma.grupoMiembro.findFirst({
    where: { grupoId: input.grupoId, usuarioId: userId, activo: true, grupo: { activo: true } },
    select: { id: true },
  });
  if (!member) throw new UserError("No perteneces a este grupo.", 403);

  const { buffer, mime } = decodeImage(input.imagen, {
    tooHeavy: "La captura supera 3 MB. Recórtala o elige una más liviana.",
    format: "Usa una captura JPG o PNG del comprobante.",
    tooLarge: "La imagen es demasiado grande. Recorta el comprobante.",
  }, VOUCHER_LIMITS.maxBytes);
  const hash = createHash("sha256").update(buffer).digest("hex");

  // Count and store under one lock: parallel uploads cannot slip past the limit while OCR runs.
  const stored = await prisma.$transaction(async (tx) => {
    await transactionLock(tx, `vouchers:${userId}`);
    const now = Date.now();
    // This person's own stale drafts (the daily job purges everyone's).
    await tx.comprobante.deleteMany({ where: { subidoPor: userId, pagoId: null, fechaCreacion: { lt: new Date(now - VOUCHER_LIMITS.draftHours * 3_600_000) } } });
    const [recent, today] = await Promise.all([
      tx.comprobante.count({ where: { subidoPor: userId, fechaCreacion: { gte: new Date(now - 10 * 60_000) } } }),
      tx.comprobante.count({ where: { subidoPor: userId, fechaCreacion: { gte: new Date(now - 86_400_000) } } }),
    ]);
    if (recent >= VOUCHER_LIMITS.per10Minutes || today >= VOUCHER_LIMITS.perDay)
      throw new UserError("Subiste muchos comprobantes seguidos. Espera unos minutos.", 429);
    return tx.comprobante.create({
      data: { subidoPor: userId, grupoId: input.grupoId, hash, imagen: { create: { mime, datos: buffer } } },
      select: { id: true },
    });
  });

  const { reading, aviso } = await read(buffer);
  const others = await prisma.grupoMiembro.findMany({
    where: { grupoId: input.grupoId, activo: true, usuarioId: { not: userId } },
    select: { usuario: { select: { id: true, nombre: true } } },
  });
  const voucher = await prisma.comprobante.update({
    where: { id: stored.id },
    data: {
      app: reading?.app ?? null,
      montoLeido: reading?.monto ?? null,
      operacion: reading?.operacion ?? null,
      destinatarioLeido: reading?.destinatario ?? null,
      fechaLeida: reading?.fecha ? new Date(`${reading.fecha}T00:00:00Z`) : null,
      codigoSeguridad: reading?.codigoSeguridad ?? null,
    },
    select: { id: true, hash: true, app: true, operacion: true },
  });
  return {
    comprobanteId: voucher.id,
    leido: !!reading,
    app: reading?.app ?? null,
    monto: reading?.monto ?? null,
    candidatos: reading?.candidatos ?? [],
    operacion: reading?.operacion ?? null,
    destinatario: reading?.destinatario ?? null,
    fecha: reading?.fecha ?? null,
    codigoSeguridad: reading?.codigoSeguridad ?? null,
    sugerenciaReceptorId: matchRecipient(reading?.destinatario ?? null, others.map((o) => o.usuario)),
    duplicado: await voucherInUse(prisma, voucher),
    advertencias: aviso ? [aviso] : reading?.advertencias ?? [],
  };
}
