import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification } from "../lib/firebase";
import { UserError } from "../domain/errors";

/** Only for a real inactive→active transition, under the group's row lock. `parte`: cents of the part taken. */
export async function saveJoinNotices(tx: Prisma.TransactionClient, grupoId: string, integranteId: string, invitedBy?: string, parte = 0) {
  const recipients = await tx.grupoMiembro.findMany({
    where: { grupoId, activo: true, usuarioId: { not: integranteId }, usuario: { activo: true },
      OR: [{ rol: "admin" }, ...(invitedBy ? [{ usuarioId: invitedBy }] : [])] },
    select: { usuarioId: true },
  });
  if (recipients.length) await tx.avisoGrupo.createMany({ data: recipients.map(({ usuarioId }) => ({ grupoId, integranteId, usuarioId, parte: parte || null })) });
  return recipients.map(({ usuarioId }) => usuarioId);
}

/** Best effort AFTER commit; the in-app notice survives unavailable device push. */
export async function pushJoinNotice(grupoId: string, integranteId: string, recipients: string[], parte = 0) {
  if (!recipients.length) return;
  try {
    const [group, person, users] = await Promise.all([
      prisma.grupo.findUnique({ where: { id: grupoId }, select: { nombre: true, activo: true } }),
      prisma.usuario.findUnique({ where: { id: integranteId }, select: { nombre: true, activo: true } }),
      prisma.usuario.findMany({ where: { id: { in: recipients }, activo: true, grupoMiembros: { some: { grupoId, activo: true } } }, select: { expoPushToken: true } }),
    ]);
    if (!group?.activo || !person?.activo) return;
    const body = parte
      ? `${person.nombre} se unió a «${group.nombre}» y ocupa una parte de S/ ${(parte / 100).toFixed(2)}. Te avisaremos cuando registre su pago.`
      : `${person.nombre} se unió a «${group.nombre}». No quedan partes libres: revisa el reparto si debe pagar algo.`;
    await Promise.all(users.filter((u) => u.expoPushToken).map((u) => sendPushNotification(u.expoPushToken!, "Alguien se unió a tu grupo", body, { type: "integrante_unido", grupoId })));
  } catch { console.error("[Notification] Join push unavailable; in-app notice preserved"); }
}

export function myGroupNotices(usuarioId: string) {
  return prisma.avisoGrupo.findMany({
    where: { usuarioId, grupo: { activo: true, miembros: { some: { usuarioId, activo: true } } } },
    include: { grupo: { select: { id: true, nombre: true } }, integrante: { select: { nombre: true } } },
    orderBy: [{ leido: "asc" }, { fecha: "desc" }], take: 40,
  });
}

export async function readGroupNotice(usuarioId: string, id: string) {
  const updated = await prisma.avisoGrupo.updateMany({
    where: { id, usuarioId, grupo: { activo: true, miembros: { some: { usuarioId, activo: true } } } }, data: { leido: true },
  });
  if (!updated.count) throw new UserError("No encontramos este aviso.", 404);
  return { leido: true };
}
