import { prisma } from "../lib/prisma";
import { convertPayment, type PaymentConversion } from "@junto/shared/currency";
import { formatMoney as money } from "@junto/shared/currency";
import { UserError as Error } from "../domain/errors";
import { resumenCuentasGrupo } from "./balance.service";
import { payableLimit } from "@junto/shared/payable";
import { sendPushNotification } from "../lib/firebase";
import { voucherInUse } from "./vouchers.service";
import { savePaymentNotices } from "./groupNotices.service";
import { referenceForDate } from "../domain/exchange";
import { transactionLock } from "../lib/transactionLock";
import type { RegistrarRecibidoInput, ReportarPagoInput } from "../schemas/pagos.schema";
import type { Prisma } from "@prisma/client";
import { syncGroupClosure } from './groupLifecycle.service';

const person = { select: { id: true, nombre: true, fotoUrl: true } } as const;
const pagoInclude = {
  pagador: person,
  receptor: { select: { id: true, nombre: true, fotoUrl: true, sinCuenta: true } },
  grupo: { select: { id: true, nombre: true, aprobacionPagos: true, moneda: true } },
  referenciaCambio: true,
  resolutor: { select: { id: true, nombre: true } },
  comprobante: { select: { id: true, app: true, montoLeido: true } },
  _count: { select: { comentarios: { where: { eliminado: false } } } },
} as const;
// Resolved payments returned by /pagos/historial (pending ones are always all included).
export const HISTORY_LIMIT = 200;
// A receiver can say "it never arrived" about a payment an admin approved for them, for this long.
const REVERT_DAYS = 30;
/**
 * A draft voucher the uploader attaches to the payment they are recording (the payer reporting it, or
 * the receiver/admin recording money already received). One screenshot never backs two payments.
 */
async function claimVoucher(tx: Prisma.TransactionClient, input: { comprobanteId?: string; grupoId: string; conversion?: PaymentConversion }, uploaderId: string, moneda: string) {
  if (!input.comprobanteId) return null;
  const voucher = await tx.comprobante.findFirst({
    where: { id: input.comprobanteId, subidoPor: uploaderId, grupoId: input.grupoId, pagoId: null },
    select: { id: true, hash: true, app: true, operacion: true, monedaLeida: true },
  });
  if (!voucher) throw new Error("El comprobante ya no está disponible. Súbelo otra vez.", 409);
  if (voucher.monedaLeida && voucher.monedaLeida !== (input.conversion?.monedaOrigen ?? moneda)) throw new Error("La moneda del comprobante no coincide con la que registras. Usa la moneda original y revisa el cambio.");
  // A group row lock alone cannot protect the same evidence submitted in two different groups.
  const keys = [`voucher-image:${voucher.hash}`];
  if (voucher.operacion && voucher.operacion.length >= 6) keys.push(`voucher-operation:${JSON.stringify([voucher.app, voucher.operacion])}`);
  for (const key of keys.sort()) await transactionLock(tx, key);
  const used = await voucherInUse(tx, voucher);
  if (used) throw new Error(used, 409);
  return voucher;
}

async function paymentCurrency(tx: Prisma.TransactionClient, input: { grupoId: string; metodo?: string; comprobanteId?: string; conversion?: PaymentConversion }) {
  const { moneda } = await tx.grupo.findUniqueOrThrow({ where: { id: input.grupoId }, select: { moneda: true } });
  if ((input.conversion?.monedaOrigen ?? moneda) !== "PEN" && (input.metodo === "yape" || input.metodo === "plin"))
    throw new Error("Yape y Plin se registran en soles. Para otra moneda elige transferencia o efectivo.");
  return moneda;
}
async function paymentConversion(tx: Prisma.TransactionClient, input: { monto: number; conversion?: PaymentConversion; comprobanteId?: string; metodo?: string; fechaEfectiva?: string }, moneda: string) {
  if (!input.conversion) return {};
  if (input.conversion.monedaOrigen !== "PEN" && (input.metodo === "yape" || input.metodo === "plin")) throw new Error("Para un pago en otra moneda selecciona efectivo o transferencia; Yape y Plin se registran en soles.");
  let result;
  try { result = convertPayment(input.conversion, moneda); }
  catch (error) { throw new Error(error instanceof globalThis.Error ? error.message : "Tipo de cambio inválido"); }
  if (result.monto !== input.monto) throw new Error("El monto del grupo no coincide con el equivalente calculado. Revisa el tipo de cambio.", 400);
  const { monto: _monto, ...evidence } = result;
  let referenciaCambioId: string | undefined;
  if (input.conversion.cotizacionId) {
    const ref = await tx.cotizacionCambio.findUnique({ where: { id: input.conversion.cotizacionId } });
    const date = input.fechaEfectiva ?? new Date().toISOString().slice(0, 10);
    if (!ref || ref.origen !== input.conversion.monedaOrigen || ref.destino !== moneda || !referenceForDate(ref.fecha.toISOString().slice(0, 10), date))
      throw new Error("La referencia no corresponde a estas monedas o a la fecha del pago. Consulta de nuevo o usa solo el cambio acordado.");
    referenciaCambioId = ref.id;
  }
  return { ...evidence, referenciaCambioId };
}
const first = (name: string) => name.trim().split(/\s+/)[0] || name;

type Rules = { pagadorId: string; receptorId: string; estado: string; resueltoPor: string | null; fechaResolucion: Date | null; grupo: { aprobacionPagos: string }; receptor?: { sinCuenta?: boolean } };

/** What a viewer may do with a payment. The payer never approves their own payment. */
export function paymentPermissions(pago: Rules, userId: string, isAdmin: boolean, now = new Date()) {
  // Someone added by name has no app to confirm with: an admin confirms for them.
  const adminMayApprove = (pago.grupo.aprobacionPagos === "administrador" || !!pago.receptor?.sinCuenta) && isAdmin;
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
        grupo: { activo: true },
        usuario: { activo: true },
        usuarioId: { in: [pagadorId, input.receptorId] },
      },
    });
    if (miembros !== 2)
      throw new Error("Ambas personas deben pertenecer al grupo");

    const moneda = await paymentCurrency(tx, input);
    const conversion = await paymentConversion(tx, input, moneda);
    // Read the ledger through this transaction (one pool connection, consistent with the lock).
    const { cuentas, simplificado, deudasDirectas } = await resumenCuentasGrupo(input.grupoId, tx);
    const waiting = await tx.pago.findMany({ where: { grupoId: input.grupoId, estado: "reportado" }, select: { pagadorId: true, receptorId: true, monto: true } });
    const { owes, owed, limit } = payableLimit(cuentas, waiting, pagadorId, input.receptorId, simplificado ? undefined : deudasDirectas);
    if (!owes) throw new Error(simplificado ? "No tienes una deuda pendiente en este grupo" : "No le debes nada a esta persona en este grupo. Págale a quien te indica la app.");
    if (!owed) throw new Error("Esta persona no tiene dinero por recibir en el grupo. Págale a quien te indica la app.");
    if (!limit) throw new Error("Ya hay pagos esperando aprobación que cubren este monto. Espera a que los revisen.");
    if (input.monto > limit) {
      throw new Error(
        `El pago no puede superar ${money(limit, moneda)}: es lo que aún debes y lo que esta persona tiene por recibir`,
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

    const voucher = await claimVoucher(tx, input, pagadorId, moneda);

    const created = await tx.pago.create({
      data: {
        grupoId: input.grupoId,
        pagadorId,
        receptorId: input.receptorId,
        monto: input.monto,
        ...conversion,
        feejunto: 0,
        metodo: input.metodo,
        estado: "reportado",
        nota: input.nota || null,
        fechaEfectiva: input.fechaEfectiva ? new Date(`${input.fechaEfectiva}T00:00:00Z`) : new Date(),
      },
    });
    await savePaymentNotices(tx, created, "pago_reportado", pagadorId);
    if (voucher) await tx.comprobante.update({ where: { id: voucher.id }, data: { pagoId: created.id } });
    return tx.pago.findUniqueOrThrow({ where: { id: created.id }, include: pagoInclude });
  });

  const payer = first(pago.pagador.nombre);
  const evidence = pago.comprobante ? " con comprobante" : "";
  void notify(
    [input.receptorId],
    "Pago por confirmar",
    `${payer} registró un pago de ${money(input.monto, pago.grupo.moneda)}${evidence}. Confírmalo cuando lo veas en tu cuenta.`,
    { grupoId: input.grupoId, pagoId: pago.id, type: "pago_reportado" },
  );
  if (pago.grupo.aprobacionPagos === "administrador" || pago.receptor.sinCuenta) {
    const reviewers = (await admins(input.grupoId)).filter((id) => id !== pagadorId && id !== input.receptorId);
    void notify(
      reviewers,
      "Pago por revisar",
      `${payer} subió un pago de ${money(input.monto, pago.grupo.moneda)}${evidence} para ${first(pago.receptor.nombre)} en ${pago.grupo.nombre}. Revísalo.`,
      { grupoId: input.grupoId, pagoId: pago.id, type: "pago_reportado" },
    );
  }
  return pago;
}

async function loadForDecision(pagoId: string, userId: string, tx: Prisma.TransactionClient) {
  const pago = await tx.pago.findUnique({ where: { id: pagoId }, include: pagoInclude });
  const member = pago && await tx.grupoMiembro.findFirst({ where: { grupoId: pago.grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { rol: true } });
  if (!pago || !member) throw new Error("Este pago ya fue resuelto o no existe");
  return { pago, permisos: paymentPermissions(pago, userId, member.rol === "admin") };
}

export async function resolverPago(
  pagoId: string,
  userId: string,
  confirmar: boolean,
) {
  // Only locate the lock here. Permissions and current state must be read after taking it:
  // another device may have changed the approval rule, membership or ledger meanwhile.
  const target = await prisma.pago.findUnique({ where: { id: pagoId }, select: { grupoId: true } });
  if (!target) throw new Error("Este pago ya fue resuelto o no existe");
  const { pago, resuelto, reverted } = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${target.grupoId}::uuid FOR UPDATE`;
    const { pago, permisos } = await loadForDecision(pagoId, userId, tx);
    const reverted = !confirmar && pago.estado === "exitoso" && permisos.marcarNoRecibido;
    if (!reverted && pago.estado !== "reportado") throw new Error("Este pago ya fue resuelto o no existe");
    if (!reverted && !permisos.aprobar) throw new Error(
      pago.pagadorId === userId ? "No puedes aprobar tu propio pago."
        : "Solo quien recibe el dinero (o el administrador, si el grupo lo permite) puede confirmar el pago",
    );
    const result = await tx.pago.updateMany({
      where: { id: pagoId, estado: reverted ? "exitoso" : "reportado" },
      data: { estado: confirmar ? "exitoso" : "rechazado", fechaResolucion: new Date(), resueltoPor: userId },
    });
    if (result.count !== 1) throw new Error("Este pago ya fue resuelto. Actualiza el grupo.");
    await savePaymentNotices(tx, pago, confirmar ? "pago_confirmado" : "pago_rechazado", userId);
    await syncGroupClosure(tx, pago.grupoId, userId);
    return { pago, reverted, resuelto: await tx.pago.findUniqueOrThrow({ where: { id: pagoId }, include: pagoInclude }) };
  });
  if (reverted) {
    void notify(
      [pago.pagadorId, ...(pago.resueltoPor ? [pago.resueltoPor] : [])], "Pago no recibido",
      `${first(pago.receptor.nombre)} indicó que no recibió el pago de ${money(pago.monto, pago.grupo.moneda)} en ${pago.grupo.nombre}. La deuda vuelve a estar pendiente.`,
      { grupoId: pago.grupoId, pagoId: pago.id, type: "pago_rechazado" },
    );
    return resuelto;
  }

  // Tell the payer (and the receiver, if an admin decided) so nobody is left guessing.
  const amount = money(pago.monto, pago.grupo.moneda);
  const byAdmin = userId !== pago.receptorId;
  const decider = first(resuelto.resolutor?.nombre || pago.receptor.nombre);
  const receiver = first(pago.receptor.nombre);
  const data = { grupoId: pago.grupoId, pagoId: pago.id, type: confirmar ? "pago_confirmado" : "pago_rechazado" };
  void notify(
    [pago.pagadorId],
    confirmar ? "Pago confirmado" : "Pago no confirmado",
    confirmar
      ? byAdmin ? `${decider} (administrador) aprobó tu pago de ${amount} a ${receiver} en ${pago.grupo.nombre}.` : `${receiver} confirmó tu pago de ${amount} en ${pago.grupo.nombre}.`
      : `${decider} no pudo confirmar tu pago de ${amount} en ${pago.grupo.nombre}. Revisa con esa persona.`,
    data,
  );
  if (byAdmin)
    void notify(
      [pago.receptorId],
      confirmar ? "Aprobaron un pago para ti" : "Rechazaron un pago para ti",
      confirmar
        ? `${decider} aprobó el pago de ${first(pago.pagador.nombre)} a ti por ${amount}. Si no te llegó, avísalo desde JUNTO.`
        : `${decider} no aprobó el pago de ${first(pago.pagador.nombre)} a ti por ${amount}. La deuda sigue pendiente.`,
      data,
    );
  return resuelto;
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
  const mine = {
    OR: [
      { pagadorId: usuarioId },
      { receptorId: usuarioId },
      { estado: "reportado", grupoId: { in: [...adminGroups] }, grupo: { activo: true }, OR: [{ grupo: { aprobacionPagos: "administrador" } }, { receptor: { sinCuenta: true } }] },
    ],
  };
  // Everything still waiting (the app needs all of it) plus the latest resolved ones: history no
  // longer grows without bound on every refresh.
  const [waiting, resolved] = await Promise.all([
    prisma.pago.findMany({ where: { AND: [mine, { estado: "reportado" }] }, include: pagoInclude, orderBy: { fechaPago: "desc" } }),
    prisma.pago.findMany({ where: { AND: [mine, { estado: { not: "reportado" } }] }, include: pagoInclude, orderBy: { fechaPago: "desc" }, take: HISTORY_LIMIT }),
  ]);
  const pagos = [...waiting, ...resolved].sort((a, b) => b.fechaPago.getTime() - a.fechaPago.getTime());
  return pagos.map((p) => withRules(p, usuarioId, adminGroups, p.grupoId));
}

/** One payment with its voucher data (only for who may see the voucher) and who can approve it. */
export async function getPagoDetalle(pagoId: string, userId: string) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: {
      ...pagoInclude,
      comprobante: { select: { id: true, app: true, montoLeido: true, monedaLeida: true, operacion: true, destinatarioLeido: true, fechaLeida: true, codigoSeguridad: true, imagen: { select: { mime: true } } } },
    },
  });
  const member = pago && await prisma.grupoMiembro.findFirst({ where: { grupoId: pago.grupoId, usuarioId: userId, activo: true }, select: { rol: true } });
  if (!pago || !member) throw new Error("No encontramos este pago.", 404);
  const permisos = paymentPermissions(pago, userId, member.rol === "admin");
  const adminIds = (pago.grupo.aprobacionPagos === "administrador" || pago.receptor.sinCuenta) ? (await admins(pago.grupoId)).filter((id) => id !== pago.pagadorId && id !== pago.receptorId) : [];
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
      monedaLeida: comprobante.monedaLeida,
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

/**
 * Whoever receives the money records it directly ("Ana me pagó S/ 75 en efectivo"): confirmed at
 * once, since the receiver is the one who would confirm it. Needed for people added by name, who
 * have no app to report it, and handy for cash.
 */
export async function registrarRecibido(input: RegistrarRecibidoInput, userId: string) {
  const receptorId = input.receptorId || userId;
  if (receptorId === input.pagadorId) throw new Error("No puedes registrar un pago de ti mismo");
  const pago = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${input.grupoId}::uuid FOR UPDATE`;
    const miembros = await tx.grupoMiembro.findMany({
      where: { grupoId: input.grupoId, activo: true, grupo: { activo: true }, usuario: { activo: true }, usuarioId: { in: [...new Set([userId, receptorId, input.pagadorId])] } },
      select: { usuarioId: true, rol: true, usuario: { select: { sinCuenta: true } } },
    });
    if (miembros.length !== new Set([userId, receptorId, input.pagadorId]).size) throw new Error("Ambas personas deben pertenecer al grupo");
    const actor = miembros.find((m) => m.usuarioId === userId);
    const receiver = miembros.find((m) => m.usuarioId === receptorId);
    if (!actor || actor.usuario.sinCuenta) throw new Error("No perteneces a este grupo", 403);
    if (receptorId !== userId && (actor.rol !== "admin" || !receiver?.usuario.sinCuenta))
      throw new Error("Solo un administrador puede registrar pagos recibidos por alguien sin cuenta.", 403);
    // An administrator cannot use this shortcut to confirm their own outgoing payment.
    if (userId === input.pagadorId) throw new Error("No puedes confirmar tu propio pago. Regístralo como pago por confirmar.", 403);
    const { cuentas, simplificado, deudasDirectas } = await resumenCuentasGrupo(input.grupoId, tx);
    const waiting = await tx.pago.findMany({ where: { grupoId: input.grupoId, estado: "reportado" }, select: { pagadorId: true, receptorId: true, monto: true } });
    const { owes, owed, limit } = payableLimit(cuentas, waiting, input.pagadorId, receptorId, simplificado ? undefined : deudasDirectas);
    if (!owes) throw new Error("Esta persona no tiene una deuda pendiente en el grupo");
    if (!owed) throw new Error(receptorId === userId ? "No tienes dinero por recibir en este grupo" : "Esta persona no tiene dinero por recibir en el grupo");
    if (!limit) throw new Error("Ya hay pagos de esta persona esperando tu confirmación: confírmalos primero.");
    const moneda = await paymentCurrency(tx, input);
    const conversion = await paymentConversion(tx, input, moneda);
    if (input.monto > limit) throw new Error(`El pago no puede superar ${money(limit, moneda)}: es lo que esta persona aún ${receptorId === userId ? "te debe" : "debe al receptor"}`);
    // Optional: the screenshot the payer sent you (Yape, Plin, transfer). Cash has none.
    const voucher = await claimVoucher(tx, input, userId, moneda);
    const now = new Date();
    const created = await tx.pago.create({
      data: { grupoId: input.grupoId, pagadorId: input.pagadorId, receptorId, monto: input.monto, ...conversion, feejunto: 0, metodo: input.metodo, estado: "exitoso", nota: input.nota || null, fechaEfectiva: input.fechaEfectiva ? new Date(`${input.fechaEfectiva}T00:00:00Z`) : now, fechaResolucion: now, resueltoPor: userId },
    });
    await savePaymentNotices(tx, created, "pago_confirmado", userId);
    if (voucher) await tx.comprobante.update({ where: { id: voucher.id }, data: { pagoId: created.id } });
    await syncGroupClosure(tx, input.grupoId, userId);
    return tx.pago.findUniqueOrThrow({ where: { id: created.id }, include: pagoInclude });
  });
  void notify(
    [input.pagadorId], "Pago registrado",
    `${receptorId === userId ? first(pago.receptor.nombre) : `${first(pago.resolutor?.nombre || "Administrador")} (administrador)`} registró que pagaste ${money(input.monto, pago.grupo.moneda)} a ${first(pago.receptor.nombre)} en ${pago.grupo.nombre}.`,
    { grupoId: input.grupoId, pagoId: pago.id, type: "pago_confirmado" },
  );
  return pago;
}
