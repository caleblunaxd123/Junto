import { formatMoney } from "@junto/shared/currency";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { sendPushNotification } from "../lib/firebase";
import { UserError } from "../domain/errors";

const first = (name: string) => name.trim().split(/\s+/)[0] || name;
export const shortMoney = (minor: number, code?: string) => formatMoney(minor, code).replace(/\.00$/, "");
export const expenseNoticeText = (actorName: string, descripcion: string, parte: number, moneda?: string) =>
  `${first(actorName)} agregó «${descripcion}»: tu parte ${shortMoney(parte, moneda)}`;

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

/** Payment notices survive a missing push token or an unavailable provider. Called under the ledger lock. */
export async function savePaymentNotices(tx: Prisma.TransactionClient, pago: { id: string; grupoId: string; pagadorId: string; receptorId: string; resueltoPor?: string | null }, tipo: "pago_reportado" | "pago_confirmado" | "pago_rechazado", actorId: string) {
  const members = await tx.grupoMiembro.findMany({ where: { grupoId: pago.grupoId, activo: true, usuario: { activo: true, sinCuenta: false } }, select: { usuarioId: true, rol: true } });
  const group = await tx.grupo.findUniqueOrThrow({ where: { id: pago.grupoId }, select: { aprobacionPagos: true } });
  const receiver = await tx.usuario.findUniqueOrThrow({ where: { id: pago.receptorId }, select: { sinCuenta: true } });
  const recipients = members.filter((m) => m.usuarioId !== actorId && (
    tipo === "pago_reportado" ? m.usuarioId === pago.receptorId || (m.rol === "admin" && m.usuarioId !== pago.pagadorId && (group.aprobacionPagos === "administrador" || receiver.sinCuenta))
      : m.usuarioId === pago.pagadorId || m.usuarioId === pago.receptorId || (tipo === "pago_rechazado" && m.usuarioId === pago.resueltoPor)
  ));
  if (recipients.length) await tx.avisoGrupo.createMany({ data: recipients.map((m) => ({ grupoId: pago.grupoId, usuarioId: m.usuarioId, integranteId: actorId, pagoId: pago.id, tipo })), skipDuplicates: true });
}

/** Expense notices for members with a JUNTO account ("Lucía agregó «Cena»: tu parte S/ 40"). */
export async function saveExpenseNotices(
  tx: Prisma.TransactionClient,
  gasto: { id: string; grupoId: string; creadoPor: string; participantes: { usuarioId: string; montoAsignado: number }[] },
) {
  const members = await tx.grupoMiembro.findMany({
    where: { grupoId: gasto.grupoId, activo: true, usuario: { activo: true, sinCuenta: false } },
    select: { usuarioId: true },
  });
  const withAccount = new Set(members.map((m) => m.usuarioId));
  const data = gasto.participantes
    .filter((p) => p.usuarioId !== gasto.creadoPor && p.montoAsignado > 0 && withAccount.has(p.usuarioId))
    .map((p) => ({
      grupoId: gasto.grupoId,
      usuarioId: p.usuarioId,
      integranteId: gasto.creadoPor,
      gastoId: gasto.id,
      parte: p.montoAsignado,
      tipo: "gasto_registrado",
    }));
  if (data.length) await tx.avisoGrupo.createMany({ data, skipDuplicates: true });
}

/** Best effort AFTER commit; the in-app notice survives unavailable device push. */
export async function pushJoinNotice(grupoId: string, integranteId: string, recipients: string[], parte = 0) {
  if (!recipients.length) return;
  try {
    const [group, person, users] = await Promise.all([
      prisma.grupo.findUnique({ where: { id: grupoId }, select: { nombre: true, activo: true, moneda: true } }),
      prisma.usuario.findUnique({ where: { id: integranteId }, select: { nombre: true, activo: true } }),
      prisma.usuario.findMany({ where: { id: { in: recipients }, activo: true, grupoMiembros: { some: { grupoId, activo: true } } }, select: { expoPushToken: true } }),
    ]);
    if (!group?.activo || !person?.activo) return;
    const body = parte
      ? `${person.nombre} se unió a «${group.nombre}» y ocupa una parte de ${formatMoney(parte, group.moneda)}. Te avisaremos cuando registre su pago.`
      : `${person.nombre} se unió a «${group.nombre}». Ya puede revisar sus cuentas y reportar sus pagos desde la web o la app.`;
    await Promise.all(users.filter((u) => u.expoPushToken).map((u) => sendPushNotification(u.expoPushToken!, "Alguien se unió a tu grupo", body, { type: "integrante_unido", grupoId })));
  } catch { console.error("[Notification] Join push unavailable; in-app notice preserved"); }
}

export async function myGroupNotices(usuarioId: string) {
  const rows = await prisma.avisoGrupo.findMany({
    where: {
      usuarioId,
      grupo: { activo: true, miembros: { some: { usuarioId, activo: true } } },
      OR: [{ gastoId: null }, { gasto: { activo: true } }],
    },
    include: {
      grupo: { select: { id: true, nombre: true, moneda: true } },
      integrante: { select: { nombre: true } },
      pago: { select: { id: true, monto: true, estado: true, pagador: { select: { nombre: true } }, receptor: { select: { nombre: true } } } },
      gasto: { select: { id: true, descripcion: true, montoTotal: true, participantes: { where: { usuarioId }, select: { montoAsignado: true } } } },
    },
    orderBy: [{ leido: "asc" }, { fecha: "desc" }], take: 40,
  });
  return rows.map((row) => {
    const liveShare = row.gasto?.participantes[0]?.montoAsignado ?? row.parte ?? 0;
    const gasto = row.gasto ? { id: row.gasto.id, descripcion: row.gasto.descripcion, montoTotal: row.gasto.montoTotal } : null;
    return {
      ...row,
      parte: row.tipo === "gasto_registrado" ? liveShare : row.parte,
      gasto,
      ...(row.tipo === "gasto_registrado" && gasto
        ? { mensaje: expenseNoticeText(row.integrante.nombre, gasto.descripcion, liveShare, row.grupo.moneda) }
        : {}),
    };
  });
}

export async function readGroupNotice(usuarioId: string, id: string) {
  const updated = await prisma.avisoGrupo.updateMany({
    where: { id, usuarioId, grupo: { activo: true, miembros: { some: { usuarioId, activo: true } } } }, data: { leido: true },
  });
  if (!updated.count) throw new UserError("No encontramos este aviso.", 404);
  return { leido: true };
}
