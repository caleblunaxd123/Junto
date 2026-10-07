import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { sendPushNotification } from "../lib/firebase";

export const COMMENT_LIMITS = { per10Minutes: 30, maxLength: 500 };
export type CommentTarget = { gastoId: string; pagoId?: undefined } | { pagoId: string; gastoId?: undefined };

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** Keeps line breaks, drops control characters and runs of blank lines. */
export function cleanComment(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0009\u000B-\u001F\u007F​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The expense or payment, its group and who is involved, if the viewer is an active member. */
async function resolveTarget(userId: string, target: CommentTarget) {
  let found: { grupoId: string; titulo: string; involucrados: string[] } | null = null;
  if (target.gastoId) {
    const gasto = await prisma.gasto.findUnique({ where: { id: target.gastoId }, select: { grupoId: true, activo: true, descripcion: true, creadoPor: true, pagadoPor: true } });
    if (gasto?.activo) found = { grupoId: gasto.grupoId, titulo: `«${gasto.descripcion}»`, involucrados: [gasto.creadoPor, gasto.pagadoPor] };
  } else {
    const pago = await prisma.pago.findUnique({ where: { id: target.pagoId }, select: { grupoId: true, monto: true, pagadorId: true, receptorId: true } });
    if (pago) found = { grupoId: pago.grupoId, titulo: `el pago de S/ ${(pago.monto / 100).toFixed(2)}`, involucrados: [pago.pagadorId, pago.receptorId] };
  }
  const member = found && await prisma.grupoMiembro.findFirst({ where: { grupoId: found.grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { rol: true } });
  if (!found || !member) throw new UserError(target.gastoId ? "No encontramos este gasto." : "No encontramos este pago.", 404);
  return { ...found, esAdmin: member.rol === "admin" };
}

export async function listComments(userId: string, target: CommentTarget) {
  const { esAdmin } = await resolveTarget(userId, target);
  const rows = await prisma.comentario.findMany({
    where: target.gastoId ? { gastoId: target.gastoId } : { pagoId: target.pagoId },
    include: { autor: { select: { id: true, nombre: true, fotoUrl: true } }, reportes: { where: { usuarioId: userId }, select: { id: true } } },
    orderBy: { fechaCreacion: "asc" },
    take: 200,
  });
  return rows.map(({ reportes, ...row }) => ({
    id: row.id,
    texto: row.eliminado ? "" : row.texto,
    eliminado: row.eliminado,
    fechaCreacion: row.fechaCreacion,
    autor: row.autor,
    mio: row.autorId === userId,
    puedeEliminar: !row.eliminado && (row.autorId === userId || esAdmin),
    reportadoPorMi: reportes.length > 0,
  }));
}

export async function createComment(userId: string, input: CommentTarget & { texto: string }) {
  const texto = cleanComment(input.texto);
  if (!texto) throw new UserError("Escribe un comentario.");
  if (texto.length > COMMENT_LIMITS.maxLength) throw new UserError(`El comentario puede tener hasta ${COMMENT_LIMITS.maxLength} caracteres.`);
  const target = await resolveTarget(userId, input);
  const where = input.gastoId ? { gastoId: input.gastoId } : { pagoId: input.pagoId };
  // A double tap or a retry right after sending returns the same comment, never a copy.
  const repeated = await prisma.comentario.findFirst({ where: { ...where, autorId: userId, texto, eliminado: false, fechaCreacion: { gte: new Date(Date.now() - 15_000) } }, select: { id: true } });
  if (repeated) return { id: repeated.id, repetido: true };
  const recent = await prisma.comentario.count({ where: { autorId: userId, fechaCreacion: { gte: new Date(Date.now() - 10 * 60_000) } } });
  if (recent >= COMMENT_LIMITS.per10Minutes) throw new UserError("Escribiste muchos comentarios seguidos. Espera unos minutos.", 429);

  const created = await prisma.comentario.create({ data: { ...where, grupoId: target.grupoId, autorId: userId, texto }, select: { id: true, autor: { select: { nombre: true } } } });

  // The people involved and whoever already commented hear about it (never the author).
  const previous = await prisma.comentario.findMany({ where: { ...where, eliminado: false }, select: { autorId: true }, distinct: ["autorId"] });
  const recipients = [...new Set([...target.involucrados, ...previous.map((p) => p.autorId)])].filter((id) => id !== userId);
  const people = recipients.length
    ? await prisma.usuario.findMany({ where: { id: { in: recipients }, activo: true, expoPushToken: { not: null }, grupoMiembros: { some: { grupoId: target.grupoId, activo: true } } }, select: { expoPushToken: true } })
    : [];
  const preview = texto.length > 90 ? `${texto.slice(0, 87)}…` : texto;
  await Promise.all(people.map((p) => sendPushNotification(p.expoPushToken!, `${first(created.autor.nombre)} comentó ${target.titulo}`, preview, {
    grupoId: target.grupoId, ...(input.gastoId ? { gastoId: input.gastoId } : { pagoId: input.pagoId! }), type: "comentario",
  }).catch(() => console.error("[Notification] Comment saved; push delivery failed"))));
  return { id: created.id, repetido: false };
}

async function loadComment(userId: string, id: string) {
  const row = await prisma.comentario.findUnique({ where: { id }, select: { id: true, autorId: true, grupoId: true, eliminado: true } });
  const member = row && await prisma.grupoMiembro.findFirst({ where: { grupoId: row.grupoId, usuarioId: userId, activo: true }, select: { rol: true } });
  if (!row || !member) throw new UserError("No encontramos este comentario.", 404);
  return { row, esAdmin: member.rol === "admin" };
}

/** The author or a group admin removes it; the text is erased, not hidden. */
export async function deleteComment(userId: string, id: string) {
  const { row, esAdmin } = await loadComment(userId, id);
  if (row.autorId !== userId && !esAdmin) throw new UserError("Solo quien lo escribió o un administrador del grupo puede eliminarlo.", 403);
  await prisma.comentario.update({ where: { id }, data: { eliminado: true, texto: "" } });
}

/** Stored for review by the JUNTO team; the reporter is never revealed to the author. */
export async function reportComment(userId: string, id: string, motivo?: string) {
  const { row } = await loadComment(userId, id);
  if (row.eliminado) return;
  if (row.autorId === userId) throw new UserError("No puedes reportar tu propio comentario. Puedes eliminarlo.");
  const already = await prisma.reporteComentario.findUnique({ where: { comentarioId_usuarioId: { comentarioId: id, usuarioId: userId } }, select: { id: true } });
  if (already) return;
  try {
    await prisma.reporteComentario.create({ data: { comentarioId: id, usuarioId: userId, motivo: motivo ? cleanComment(motivo).slice(0, 200) : null } });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return;
    throw error;
  }
  // Ids only: the text stays in the database for whoever reviews it.
  console.warn(`[Moderation] Comment ${id} reported in group ${row.grupoId}`);
}
