import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification } from "../lib/firebase";
import { UserError } from "../domain/errors";

/** Only for a real inactive→active transition, under the group's row lock. */
export async function saveJoinNotices(tx: Prisma.TransactionClient, grupoId: string, integranteId: string, invitedBy?: string) {
  const recipients = await tx.grupoMiembro.findMany({
    where: { grupoId, activo: true, usuarioId: { not: integranteId }, usuario: { activo: true },
      OR: [{ rol: "admin" }, ...(invitedBy ? [{ usuarioId: invitedBy }] : [])] },
    select: { usuarioId: true },
  });
  if (recipients.length) await tx.avisoGrupo.createMany({ data: recipients.map(({ usuarioId }) => ({ grupoId, integranteId, usuarioId })) });
  return recipients.map(({ usuarioId }) => usuarioId);
}

/** Best effort AFTER commit; the in-app notice survives unavailable device push. */
export async function pushJoinNotice(grupoId: string, integranteId: string, recipients: string[]) {
  if (!recipients.length) return;
  try {
    const [group, person, users] = await Promise.all([
      prisma.grupo.findUnique({ where: { id: grupoId }, select: { nombre: true, activo: true } }),
      prisma.usuario.findUnique({ where: { id: integranteId }, select: { nombre: true, activo: true } }),
      prisma.usuario.findMany({ where: { id: { in: recipients }, activo: true, grupoMiembros: { some: { grupoId, activo: true } } }, select: { expoPushToken: true } }),
    ]);
    if (!group?.activo || !person?.activo) return;
    await Promise.all(users.filter((u) => u.expoPushToken).map((u) => sendPushNotification(u.expoPushToken!, "Tu grupo tiene un nuevo integrante", `${person.nombre} se unió a «${group.nombre}». Revisa el reparto antes de incluirle en la cuenta.`, { type: "integrante_unido", grupoId })));
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
