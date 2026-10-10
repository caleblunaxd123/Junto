import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { sendPushNotification } from "../lib/firebase";
import { transactionLock } from "../lib/transactionLock";
import { saveJoinNotices, pushJoinNotice } from "./groupNotices.service";
import { takeFreeParts } from "./billParts.service";
import { cuentaPorPartes } from "./grupos.service";

export const INVITE_LIMITS = { perDay: 40, quietDaysAfterRejection: 7 };
// Same answer whether or not the e-mail/phone has an account: inviting must not reveal who uses JUNTO.
export const INVITE_SENT = "Si esa persona tiene cuenta en JUNTO, verá tu invitación en su inicio. Para asegurarte, envíale también el enlace del grupo.";

const first = (name: string) => name.trim().split(/\s+/)[0] || name;

/** The registered person an e-mail or phone points to, only when it is unambiguous. */
async function findPerson(identifier: string) {
  const value = identifier.trim();
  if (value.includes("@")) return prisma.usuario.findFirst({ where: { email: value.toLowerCase(), activo: true }, select: { id: true, expoPushToken: true } });
  const phone = value.replace(/^\+?51\s*/, "").replace(/\s/g, "");
  if (!/^9\d{8}$/.test(phone)) return null;
  // Phones are not verified: if two accounts claim the same number, invite nobody.
  const matches = await prisma.usuario.findMany({ where: { celular: phone, activo: true }, select: { id: true, expoPushToken: true }, take: 2 });
  return matches.length === 1 ? matches[0] : null;
}

/**
 * Invites a registered person to a group. They are not added (and nobody sees their contact data)
 * until they accept. The answer never says whether the identifier has an account.
 */
export async function invitePerson(grupoId: string, inviterId: string, identifier: string) {
  const inviter = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: inviterId, activo: true, grupo: { activo: true } },
    select: { usuario: { select: { nombre: true } }, grupo: { select: { nombre: true } } },
  });
  if (!inviter) throw new UserError("No perteneces a este grupo.", 403);
  const today = await prisma.invitacion.count({ where: { invitadoPor: inviterId, fechaCreacion: { gte: new Date(Date.now() - 86_400_000) } } });
  if (today >= INVITE_LIMITS.perDay) throw new UserError("Enviaste muchas invitaciones hoy. Comparte el enlace del grupo por WhatsApp.", 429);

  const person = await findPerson(identifier);
  if (!person || person.id === inviterId) return { alreadyMember: person?.id === inviterId, mensaje: INVITE_SENT };
  const member = await prisma.grupoMiembro.findUnique({ where: { grupoId_usuarioId: { grupoId, usuarioId: person.id } }, select: { activo: true } });
  if (member?.activo) return { alreadyMember: true, mensaje: "Esta persona ya está en el grupo." };

  const notify = await prisma.$transaction(async (tx) => {
    await transactionLock(tx, `invite:${grupoId}:${person.id}`);
    const previous = await tx.invitacion.findUnique({ where: { grupoId_invitadoId: { grupoId, invitadoId: person.id } } });
    if (previous?.estado === "pendiente") return false;
    // Someone who said no is not asked again right away.
    if (previous?.estado === "rechazada" && previous.fechaRespuesta && Date.now() - previous.fechaRespuesta.getTime() < INVITE_LIMITS.quietDaysAfterRejection * 86_400_000) return false;
    await tx.invitacion.upsert({
      where: { grupoId_invitadoId: { grupoId, invitadoId: person.id } },
      create: { grupoId, invitadoId: person.id, invitadoPor: inviterId },
      update: { estado: "pendiente", invitadoPor: inviterId, fechaCreacion: new Date(), fechaRespuesta: null },
    });
    return true;
  });
  if (notify && person.expoPushToken)
    void sendPushNotification(person.expoPushToken, "Te invitaron a un grupo", `${first(inviter.usuario.nombre)} te invitó a «${inviter.grupo.nombre}» en JUNTO.`, { type: "invitacion" })
      .catch(() => console.error("[Notification] Invitation saved; push delivery failed"));
  return { alreadyMember: false, mensaje: INVITE_SENT };
}

/** Invitations waiting for the signed-in person, with only what they need to decide. */
export async function myInvitations(userId: string) {
  const rows = await prisma.invitacion.findMany({
    where: { invitadoId: userId, estado: "pendiente", grupo: { activo: true } },
    include: {
      grupo: { select: { id: true, nombre: true, tipo: true, modo: true, _count: { select: { miembros: { where: { activo: true } } } } } },
      anfitrion: { select: { nombre: true } },
    },
    orderBy: { fechaCreacion: "desc" },
    take: 20,
  });
  return Promise.all(rows.map(async (row) => {
    // What accepting means in money: the part this person would take, if one is free.
    const cuenta = await cuentaPorPartes(row.grupo.id);
    return {
      id: row.id,
      fechaCreacion: row.fechaCreacion,
      invitadoPor: first(row.anfitrion.nombre),
      grupo: { id: row.grupo.id, nombre: row.grupo.nombre, tipo: row.grupo.tipo, modo: row.grupo.modo, miembros: row.grupo._count.miembros },
      cuenta: cuenta && { montoTotal: cuenta.montoTotal, partes: cuenta.partes, parte: cuenta.parte, libres: cuenta.libres },
    };
  }));
}

export async function answerInvitation(userId: string, id: string, accept: boolean) {
  const result = await prisma.$transaction(async (tx) => {
    const invitation = await tx.invitacion.findFirst({ where: { id, invitadoId: userId }, include: { grupo: { select: { id: true, nombre: true, activo: true } } } });
    if (!invitation || !invitation.grupo.activo) throw new UserError("Esta invitación ya no está disponible.", 404);
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${invitation.grupoId}::uuid FOR UPDATE`;
    const current = await tx.invitacion.findUnique({ where: { id }, include: { grupo: { select: { activo: true } } } });
    if (!current?.grupo.activo) throw new UserError("Esta invitación ya no está disponible.", 404);
    if (current.estado !== "pendiente") throw new UserError("Ya respondiste esta invitación.", 409);
    const changed = await tx.invitacion.updateMany({ where: { id, estado: "pendiente" }, data: { estado: accept ? "aceptada" : "rechazada", fechaRespuesta: new Date() } });
    if (changed.count !== 1) throw new UserError("Ya respondiste esta invitación.", 409);
    let recipients: string[] = [];
    let parte = 0;
    if (accept) {
      const member = await tx.grupoMiembro.findUnique({ where: { grupoId_usuarioId: { grupoId: invitation.grupoId, usuarioId: userId } } });
      // Rejoining never restores an old admin role; someone already in the group keeps theirs.
      if (!member) await tx.grupoMiembro.create({ data: { grupoId: invitation.grupoId, usuarioId: userId, rol: "miembro" } });
      else if (!member.activo) await tx.grupoMiembro.update({ where: { id: member.id }, data: { activo: true, rol: "miembro", fechaUnion: new Date() } });
      if (!member?.activo) {
        parte = await takeFreeParts(tx, invitation.grupoId, userId);
        recipients = await saveJoinNotices(tx, invitation.grupoId, userId, invitation.invitadoPor, parte);
      }
    }
    return { grupoId: invitation.grupo.id, nombre: invitation.grupo.nombre, aceptada: accept, recipients, parte };
  });
  void pushJoinNotice(result.grupoId, userId, result.recipients, result.parte);
  const { recipients: _recipients, ...response } = result;
  return response;
}
