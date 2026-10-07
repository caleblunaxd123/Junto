import crypto from "crypto";
import { quickBillProgress } from "@junto/shared/quickBill";
import {
  expenseShareMessage,
  groupShareMessage,
  quickBillShareMessage,
  shareEmailHtml,
  shareEmailText,
  shareFingerprint,
  validShareEmail,
  type ShareMessage,
} from "@junto/shared/share";
import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { deliverWithReceipt, emailProvider } from "../lib/email";
import { describeError } from "../lib/logSafe";
import { transactionLock } from "../lib/transactionLock";
import { quickBillReadSchema } from "../schemas/quickBill.schema";
import { getGrupoDetalle } from "./grupos.service";
import { getGastoDetalle } from "./gastos.service";

export type ShareResource = { tipo: "cuenta_rapida" | "grupo" | "gasto"; id: string };
export type ShareEmailStatus = "enviando" | "aceptado" | "fallido" | "incierto";

/** Abuse limits: JUNTO sends summaries of your own records, it is not an open mail relay. */
export const SHARE_EMAIL_LIMITS = { per10Minutes: 5, perDay: 30, recipientsPerDay: 10, sameRecipientMinutes: 10 };

const notFound = () => new UserError("No encontramos ese resumen o no tienes acceso a él.", 404, "RECURSO_NO_DISPONIBLE");

/** Rebuilds the summary from authoritative server data, after checking the person may see it. */
export async function buildShareMessage(userId: string, recurso: ShareResource): Promise<ShareMessage> {
  if (recurso.tipo === "cuenta_rapida") {
    const row = await prisma.cuentaRapida.findFirst({ where: { id: recurso.id, creadoPor: userId } });
    if (!row) throw notFound();
    const datos = quickBillReadSchema.parse(row.datos);
    const progress = quickBillProgress(datos, row.aportes as Record<string, number>, row.recibidos as string[]);
    return quickBillShareMessage(datos, progress.aportes);
  }
  if (recurso.tipo === "grupo") {
    const group = await getGrupoDetalle(recurso.id, userId).catch(() => { throw notFound(); });
    return groupShareMessage(group, group.pagosPorConfirmar);
  }
  const expense = await getGastoDetalle(recurso.id, userId).catch(() => { throw notFound(); });
  const group = await prisma.grupo.findUnique({ where: { id: expense.grupoId }, select: { nombre: true, activo: true } });
  if (!group?.activo) throw notFound();
  return expenseShareMessage(expense, group.nombre);
}

function recipientHash(email: string) {
  // Keyed hash: enough to deduplicate and limit, useless to rebuild a list of addresses.
  const key = process.env.EMAIL_HASH_SECRET || process.env.JWT_SECRET || "junto-local";
  return crypto.createHmac("sha256", key).update(email).digest("hex");
}

export function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  return `${local.slice(0, 1)}***@${domain}`.slice(0, 80);
}

function isTimeout(error: unknown) {
  const e = error as { code?: string; message?: string };
  return ["ECONNABORTED", "ETIMEDOUT", "ESOCKETTIMEDOUT", "ETIMEOUT"].includes(e?.code ?? "") || /timeout/i.test(e?.message ?? "");
}

const outcome = {
  aceptado: (to: string) => `El proveedor de correo aceptó el envío a ${to}. Eso no confirma que llegó a la bandeja ni que lo leyeron: pídele que revise también spam o promociones.`,
  fallido: () => "El proveedor de correo rechazó el envío. No se envió nada. Puedes intentarlo de nuevo o abrirlo en tu app de correo.",
  incierto: () => "No sabemos si se envió: el proveedor no respondió a tiempo. Pregunta antes de reenviarlo, para no mandar un duplicado.",
  enviando: () => "Este envío ya está en curso. Espera unos segundos y revisa el resultado.",
};

/** A duplicate of an in-flight request waits for its outcome instead of sending again. */
async function settled(id: string) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const row = await prisma.correoCompartido.findUniqueOrThrow({ where: { id } });
    if (row.estado !== "enviando") return row;
    // The server stopped mid-send: we cannot know if the provider got it.
    if (Date.now() - row.fechaCreacion.getTime() > 2 * 60_000) return prisma.correoCompartido.update({ where: { id }, data: { estado: "incierto" } });
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return prisma.correoCompartido.findUniqueOrThrow({ where: { id } });
}

function present(row: { id: string; estado: string; destinatarioMascara: string; fechaCreacion: Date }) {
  const estado = row.estado as ShareEmailStatus;
  return {
    id: row.id,
    estado,
    destinatario: row.destinatarioMascara,
    fecha: row.fechaCreacion,
    mensaje: estado === "aceptado" ? outcome.aceptado(row.destinatarioMascara) : outcome[estado](),
  };
}

export function shareEmailAvailability() {
  return { disponible: !!emailProvider() };
}

export async function sendShareEmail(
  userId: string,
  input: { recurso: ShareResource; destinatario: string; solicitudId: string; huella: string },
) {
  // 1. Same request again (double tap, retry): answer with what already happened, never send twice.
  const previous = await prisma.correoCompartido.findUnique({ where: { usuarioId_solicitudId: { usuarioId: userId, solicitudId: input.solicitudId } } });
  if (previous) return present(await settled(previous.id));

  if (!emailProvider())
    throw new UserError("El envío desde JUNTO todavía no está configurado. Ábrelo en tu app de correo.", 503, "EMAIL_NO_CONFIGURADO");

  const to = input.destinatario.trim().toLowerCase();
  if (!validShareEmail(to)) throw new UserError("Revisa el correo del destinatario: escribe una sola dirección válida.", 400, "DESTINATARIO_INVALIDO");

  // 2. Content comes from the database, never from the client. If it changed since the person
  //    reviewed it, stop instead of mailing a version they never saw.
  const message = await buildShareMessage(userId, input.recurso);
  if (shareFingerprint(message) !== input.huella)
    throw new UserError("Las cuentas cambiaron desde que las revisaste. Vuelve a abrir el resumen y revísalo antes de enviarlo.", 409, "CONTENIDO_CAMBIO");

  // 3. Limits per person (shared across API instances because they live in the database).
  const hash = recipientHash(to);
  const now = Date.now();
  const claim = await prisma.$transaction(async (tx) => {
    // Different request ids can race too. Serialize the check-and-reserve per sender across instances.
    await transactionLock(tx, `share-email:${userId}`);
    const duplicate = await tx.correoCompartido.findUnique({ where: { usuarioId_solicitudId: { usuarioId: userId, solicitudId: input.solicitudId } } });
    if (duplicate) return { row: duplicate, repeated: true };
    const recent = await tx.correoCompartido.findMany({
      where: { usuarioId: userId, fechaCreacion: { gt: new Date(now - 24 * 60 * 60_000) } },
      select: { destinatarioHash: true, recursoTipo: true, recursoId: true, estado: true, fechaCreacion: true },
    });
    if (recent.some((r) => r.destinatarioHash === hash && r.recursoTipo === input.recurso.tipo && r.recursoId === input.recurso.id && ["aceptado", "enviando", "incierto"].includes(r.estado) && now - r.fechaCreacion.getTime() < SHARE_EMAIL_LIMITS.sameRecipientMinutes * 60_000))
      throw new UserError("Ya hay un envío reciente de este resumen a ese correo. Revisa su resultado antes de repetirlo.", 409, "YA_ENVIADO");
    if (recent.filter((r) => now - r.fechaCreacion.getTime() < 10 * 60_000).length >= SHARE_EMAIL_LIMITS.per10Minutes)
      throw new UserError("Enviaste varios correos seguidos. Espera unos minutos o compártelo desde tu app de correo.", 429, "LIMITE_CORREOS");
    if (recent.length >= SHARE_EMAIL_LIMITS.perDay)
      throw new UserError("Llegaste al límite de correos de hoy. Puedes compartirlo desde tu app de correo.", 429, "LIMITE_CORREOS");
    const recipients = new Set(recent.map((r) => r.destinatarioHash));
    if (!recipients.has(hash) && recipients.size >= SHARE_EMAIL_LIMITS.recipientsPerDay)
      throw new UserError("Hoy ya enviaste resúmenes a muchas direcciones distintas. Puedes compartirlo desde tu app de correo.", 429, "LIMITE_DESTINATARIOS");

    // 4. Reserve the rate-limit slot before sending; no provider I/O while the lock is held.
    const row = await tx.correoCompartido.create({
      data: { usuarioId: userId, solicitudId: input.solicitudId, recursoTipo: input.recurso.tipo, recursoId: input.recurso.id, destinatarioHash: hash, destinatarioMascara: maskEmail(to), estado: "enviando" },
    });
    return { row, repeated: false };
  });
  if (claim.repeated) return present(await settled(claim.row.id));
  const row = claim.row;

  const sender = await prisma.usuario.findUniqueOrThrow({ where: { id: userId }, select: { nombre: true, email: true } });
  const sentBy = sender.nombre.replace(/[\r\n\u0000-\u001f]/g, " ").trim().slice(0, 60);
  let estado: ShareEmailStatus;
  let providerId: string | undefined;
  try {
    const receipt = await deliverWithReceipt({
      to,
      // Who shares it goes first, so the recipient recognises it; no line breaks can reach headers.
      subject: `${sentBy} te compartió: ${message.subject}`.replace(/[\r\n]/g, " ").slice(0, 180),
      html: shareEmailHtml(message, { sentBy }),
      text: shareEmailText(message, { sentBy }),
      // Replies go to the person who shared it, not to a no-reply inbox.
      replyTo: sender.email,
    });
    estado = receipt.accepted ? "aceptado" : "fallido";
    providerId = receipt.providerId;
  } catch (error) {
    estado = isTimeout(error) ? "incierto" : "fallido";
    console.error("[Email] Shared summary delivery", estado, describeError(error));
  }
  return present(await prisma.correoCompartido.update({ where: { id: row.id }, data: { estado, proveedorId: providerId } }));
}
