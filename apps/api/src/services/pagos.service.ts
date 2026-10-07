import { prisma } from "../lib/prisma";
import { UserError as Error } from "../domain/errors";
import { calcularSaldosGrupo } from "./balance.service";
import { sendPushNotification } from "../lib/firebase";
import { voucherInUse } from "./vouchers.service";
import { transactionLock } from "../lib/transactionLock";
import type { ReportarPagoInput } from "../schemas/pagos.schema";

const person = { select: { id: true, nombre: true, fotoUrl: true } } as const;
const pagoInclude = {
  pagador: person,
  receptor: person,
  grupo: { select: { id: true, nombre: true, aprobacionPagos: true } },
  resolutor: { select: { id: true, nombre: true } },
  comprobante: { select: { id: true, app: true, montoLeido: true } },
  _count: { select: { comentarios: { where: { eliminado: false } } } },
} as const;
// A receiver can say "it never arrived" about a payment an admin approved for them, for this long.
const REVERT_DAYS = 30;
const money = (cents: number) => `S/ ${(cents / 100).toFixed(2)}`;
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

type Rules = { pagadorId: string; receptorId: string; estado: string; resueltoPor: string | null; fechaResolucion: Date | null; grupo: { aprobacionPagos: string } };

/** What a viewer may do with a payment. The payer never approves their own payment. */
export function paymentPermissions(pago: Rules, userId: string, isAdmin: boolean, now = new Date()) {
  const adminMayApprove = pago.grupo.aprobacionPagos === "administrador" && isAdmin;
  const approver = userId !== pago.pagadorId && (userId === pago.receptorId || adminMayApprove);
  const approvedByOther = pago.estado === "exitoso" && !!pago.resueltoPor && pago.resueltoPor !== pago.receptorId;
  const recent = !!pago.fechaResolucion && now.getTime() - pago.fechaResolucion.getTime() < REVERT_DAYS * 86_400_000;
  return {
    aprobar: pago.estado === "reportado" && approver,
    // Who receives the money always has the last word over what an admin approved for them.
    marcarNoRecibido: userId === pago.receptorId && approvedByOther && recent,
    // The image shows names and partial phone numbers: only the two people involved and approvers.
    verComprobante: userId === pago.pagadorId || userId === pago.receptorId || adminMayApprove,
  };
}

async function notify(userIds: string[], title: string, body: string, data: Record<string, string>) {
  const people = await prisma.usuario.findMany({ where: { id: { in: [...new Set(userIds)] }, activo: true }, select: { expoPushToken: true } });
  await Promise.all(people.filter((p) => p.expoPushToken).map((p) =>
    sendPushNotification(p.expoPushToken!, title, body, data).catch(() => console.error("[Notification] Payment update; push delivery failed")),
  ));
}

async function admins(grupoId: string) {
  return (await prisma.grupoMiembro.findMany({ where: { grupoId, activo: true, rol: "admin" }, select: { usuarioId: true } })).map((m) => m.usuarioId);
}

export async function reportarPago(
  input: ReportarPagoInput,
  pagadorId: string,
) {
  if (pagadorId === input.receptorId)
    throw new Error("No puedes registrar un pago para ti mismo");
  const pago = await prisma.$transaction(async (tx) => {
    // Prevent two simultaneous taps/devices from creating the same pending payment.
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${input.grupoId}::uuid FOR UPDATE`;
    const miembros = await tx.grupoMiembro.count({
      where: {
        grupoId: input.grupoId,
        activo: true,
        usuarioId: { in: [pagadorId, input.receptorId] },
      },
    });
    if (miembros !== 2)
      throw new Error("Ambas personas deben pertenecer al grupo");

    const saldo = (await calcularSaldosGrupo(input.grupoId)).find(
      (item) =>
        item.deudorId === pagadorId && item.acreedorId === input.receptorId,
    );
    if (!saldo)
      throw new Error("No tienes una deuda pendiente con esta persona");
    if (input.monto > saldo.monto) {
      throw new Error(
        `El pago no puede superar tu saldo pendiente de S/ ${(saldo.monto / 100).toFixed(2)}`,
      );
    }

    const pendiente = await tx.pago.findFirst({
      where: {
        grupoId: input.grupoId,
        pagadorId,
        receptorId: input.receptorId,
        estado: "reportado",
      },
    });
    if (pendiente)
      throw new Error("Ya existe un pago esperando confirmación entre ustedes");

    let voucher = null;
    if (input.comprobanteId) {
      voucher = await tx.comprobante.findFirst({
        where: { id: input.comprobanteId, subidoPor: pagadorId, grupoId: input.grupoId, pagoId: null },
        select: { id: true, hash: true, app: true, operacion: true },
      });
      if (!voucher) throw new Error("El comprobante ya no está disponible. Súbelo otra vez.", 409);
      // A group row lock alone cannot protect the same evidence submitted in two different groups.
      const keys = [`voucher-image:${voucher.hash}`];
      if (voucher.operacion && voucher.operacion.length >= 6) keys.push(`voucher-operation:${JSON.stringify([voucher.app, voucher.operacion])}`);
      for (const key of keys.sort()) await transactionLock(tx, key);
      const used = await voucherInUse(tx, voucher);
      if (used) throw new Error(used, 409);
    }

    const created = await tx.pago.create({
      data: {
        grupoId: input.grupoId,
        pagadorId,
        receptorId: input.receptorId,
        monto: input.monto,
        feejunto: 0,
        metodo: input.metodo,
        estado: "reportado",
        nota: input.nota || null,
      },
    });
    if (voucher) await tx.comprobante.update({ where: { id: voucher.id }, data: { pagoId: created.id } });
    return tx.pago.findUniqueOrThrow({ where: { id: created.id }, include: pagoInclude });
  });

  const payer = first(pago.pagador.nombre);
  const evidence = pago.comprobante ? " con comprobante" : "";
  await notify(
    [input.receptorId],
    "Pago por confirmar",
    `${payer} registró un pago de ${money(input.monto)}${evidence}. Confírmalo cuando lo veas en tu cuenta.`,
    { grupoId: input.grupoId, pagoId: pago.id, type: "pago_reportado" },
  );
  if (pago.grupo.aprobacionPagos === "administrador") {
    const reviewers = (await admins(input.grupoId)).filter((id) => id !== pagadorId && id !== input.receptorId);
    await notify(
      reviewers,
      "Pago por revisar",
      `${payer} subió un pago de ${money(input.monto)}${evidence} para ${first(pago.receptor.nombre)} en ${pago.grupo.nombre}. Revísalo.`,
      { grupoId: input.grupoId, pagoId: pago.id, type: "pago_reportado" },
    );
  }
  return pago;
}

async function loadForDecision(pagoId: string, userId: string) {
  const pago = await prisma.pago.findUnique({ where: { id: pagoId }, include: pagoInclude });
  const member = pago && await prisma.grupoMiembro.findFirst({ where: { grupoId: pago.grupoId, usuarioId: userId, activo: true }, select: { rol: true } });
  if (!pago || !member) throw new Error("Este pago ya fue resuelto o no existe");
  return { pago, permisos: paymentPermissions(pago, userId, member.rol === "admin") };
}

export async function resolverPago(
  pagoId: string,
  userId: string,
  confirmar: boolean,
) {
  const { pago, permisos } = await loadForDecision(pagoId, userId);
  if (!confirmar && pago.estado === "exitoso" && permisos.marcarNoRecibido) return marcarNoRecibido(pago, userId);
  if (pago.estado !== "reportado")
    throw new Error("Este pago ya fue resuelto o no existe");
  if (!permisos.aprobar)
    throw new Error(
      pago.pagadorId === userId
        ? "No puedes aprobar tu propio pago."
        : "Solo quien recibe el dinero (o el administrador, si el grupo lo permite) puede confirmar el pago",
    );

  const result = await prisma.pago.updateMany({
    where: { id: pagoId, estado: "reportado" },
    data: {
      estado: confirmar ? "exitoso" : "rechazado",
      fechaResolucion: new Date(),
      resueltoPor: userId,
    },
  });
  if (result.count !== 1)
    throw new Error("Este pago ya fue resuelto. Actualiza el grupo.");
  const resuelto = await prisma.pago.findUniqueOrThrow({ where: { id: pagoId }, include: pagoInclude });

  // Tell the payer (and the receiver, if an admin decided) so nobody is left guessing.
  const amount = money(pago.monto);
  const byAdmin = userId !== pago.receptorId;
  const decider = first(resuelto.resolutor?.nombre || pago.receptor.nombre);
  const receiver = first(pago.receptor.nombre);
  const data = { grupoId: pago.grupoId, pagoId: pago.id, type: confirmar ? "pago_confirmado" : "pago_rechazado" };
  await notify(
    [pago.pagadorId],
    confirmar ? "Pago confirmado" : "Pago no confirmado",
    confirmar
      ? byAdmin ? `${decider} (administrador) aprobó tu pago de ${amount} a ${receiver} en ${pago.grupo.nombre}.` : `${receiver} confirmó tu pago de ${amount} en ${pago.grupo.nombre}.`
      : `${decider} no pudo confirmar tu pago de ${amount} en ${pago.grupo.nombre}. Revisa con esa persona.`,
    data,
  );
  if (byAdmin)
    await notify(
      [pago.receptorId],
      confirmar ? "Aprobaron un pago para ti" : "Rechazaron un pago para ti",
      confirmar
        ? `${decider} aprobó el pago de ${first(pago.pagador.nombre)} a ti por ${amount}. Si no te llegó, avísalo desde JUNTO.`
        : `${decider} no aprobó el pago de ${first(pago.pagador.nombre)} a ti por ${amount}. La deuda sigue pendiente.`,
      data,
    );
  return resuelto;
}

/** The receiver says an admin-approved payment never arrived: the debt is pending again. */
async function marcarNoRecibido(pago: { id: string; grupoId: string; pagadorId: string; receptorId: string; monto: number; resueltoPor: string | null; receptor: { nombre: string }; grupo: { nombre: string } }, userId: string) {
  const result = await prisma.pago.updateMany({
    where: { id: pago.id, estado: "exitoso", receptorId: userId, resueltoPor: { not: userId } },
    data: { estado: "rechazado", fechaResolucion: new Date(), resueltoPor: userId },
  });
  if (result.count !== 1) throw new Error("Este pago cambió. Actualiza el grupo.", 409);
  await notify(
    [pago.pagadorId, ...(pago.resueltoPor ? [pago.resueltoPor] : [])],
    "Pago no recibido",
    `${first(pago.receptor.nombre)} indicó que no recibió el pago de ${money(pago.monto)} en ${pago.grupo.nombre}. La deuda vuelve a estar pendiente.`,
    { grupoId: pago.grupoId, pagoId: pago.id, type: "pago_rechazado" },
  );
  return prisma.pago.findUniqueOrThrow({ where: { id: pago.id }, include: pagoInclude });
}

function withRules<T extends Rules>(pago: T, userId: string, adminGroups: Set<string>, grupoId: string) {
  return { ...pago, permisos: paymentPermissions(pago, userId, adminGroups.has(grupoId)) };
}

/**
 * The viewer's payments, plus the ones waiting in groups where they are an admin allowed to approve
 * them. Each carries what the viewer may do with it.
 */
export async function getHistorial(usuarioId: string) {
  const adminGroups = new Set((await prisma.grupoMiembro.findMany({ where: { usuarioId, activo: true, rol: "admin" }, select: { grupoId: true } })).map((m) => m.grupoId));
  const pagos = await prisma.pago.findMany({
    where: {
      OR: [
        { pagadorId: usuarioId },
        { receptorId: usuarioId },
        { estado: "reportado", grupoId: { in: [...adminGroups] }, grupo: { aprobacionPagos: "administrador", activo: true } },
      ],
    },
    include: pagoInclude,
    orderBy: { fechaPago: "desc" },
  });
  return pagos.map((p) => withRules(p, usuarioId, adminGroups, p.grupoId));
}

/** One payment with its voucher data (only for who may see the voucher) and who can approve it. */
export async function getPagoDetalle(pagoId: string, userId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: {
      ...pagoInclude,
      comprobante: { select: { id: true, app: true, montoLeido: true, operacion: true, destinatarioLeido: true, fechaLeida: true, codigoSeguridad: true, imagen: { select: { mime: true } } } },
    },
  });
  const member = pago && await prisma.grupoMiembro.findFirst({ where: { grupoId: pago.grupoId, usuarioId: userId, activo: true }, select: { rol: true } });
  if (!pago || !member) throw new Error("No encontramos este pago.", 404);
  const permisos = paymentPermissions(pago, userId, member.rol === "admin");
  const adminIds = pago.grupo.aprobacionPagos === "administrador" ? (await admins(pago.grupoId)).filter((id) => id !== pago.pagadorId && id !== pago.receptorId) : [];
  const adminNames = adminIds.length ? await prisma.usuario.findMany({ where: { id: { in: adminIds } }, select: { id: true, nombre: true } }) : [];
  const { comprobante, ...rest } = pago;
  return {
    ...rest,
    permisos,
    aprobadores: [{ id: pago.receptor.id, nombre: pago.receptor.nombre, rol: "receptor" }, ...adminNames.map((a) => ({ ...a, rol: "administrador" }))],
    comprobante: comprobante && {
      id: comprobante.id,
      app: comprobante.app,
      montoLeido: comprobante.montoLeido,
      imagenDisponible: !!comprobante.imagen,
      // Read details can carry names and partial numbers: only for who may see the image.
      ...(permisos.verComprobante ? {
        operacion: comprobante.operacion,
        destinatarioLeido: comprobante.destinatarioLeido,
        fechaLeida: comprobante.fechaLeida?.toISOString().slice(0, 10) ?? null,
        codigoSeguridad: comprobante.codigoSeguridad,
      } : {}),
    },
  };
}

export async function getComprobanteImagen(pagoId: string, userId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    select: { pagadorId: true, receptorId: true, estado: true, resueltoPor: true, fechaResolucion: true, grupoId: true, grupo: { select: { aprobacionPagos: true } }, comprobante: { select: { imagen: true } } },
  });
  const member = pago && await prisma.grupoMiembro.findFirst({ where: { grupoId: pago.grupoId, usuarioId: userId, activo: true }, select: { rol: true } });
  if (!pago || !member || !paymentPermissions(pago, userId, member.rol === "admin").verComprobante) throw new Error("No encontramos este comprobante.", 404);
  const image = pago.comprobante?.imagen;
  if (!image) throw new Error("La imagen de este comprobante ya no está disponible.", 404);
  return { mime: image.mime, imagen: Buffer.from(image.datos).toString("base64") };
}
