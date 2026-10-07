import { prisma } from "../lib/prisma";
import { UserError as Error } from "../domain/errors";
import { calcularSaldosGrupo } from "./balance.service";
import { sendPushNotification } from "../lib/firebase";
import type { ReportarPagoInput } from "../schemas/pagos.schema";

const pagoInclude = {
  pagador: { select: { id: true, nombre: true, fotoUrl: true } },
  receptor: { select: { id: true, nombre: true, fotoUrl: true } },
  grupo: { select: { id: true, nombre: true } },
} as const;

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

    return tx.pago.create({
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
      include: pagoInclude,
    });
  });

  const receptor = await prisma.usuario.findUnique({
    where: { id: input.receptorId },
    select: { expoPushToken: true },
  });
  const pagador = await prisma.usuario.findUnique({
    where: { id: pagadorId },
    select: { nombre: true },
  });
  if (receptor?.expoPushToken && pagador) {
    await sendPushNotification(
      receptor.expoPushToken,
      "Pago por confirmar",
      `${pagador.nombre} registró un pago de S/ ${(input.monto / 100).toFixed(2)}. Confírmalo cuando lo veas en tu cuenta.`,
      { grupoId: input.grupoId, pagoId: pago.id, type: "pago_reportado" },
    ).catch(() =>
      console.error("[Notification] Payment recorded; push delivery failed"),
    );
  }
  return pago;
}

export async function resolverPago(
  pagoId: string,
  receptorId: string,
  confirmar: boolean,
) {
  const pago = await prisma.pago.findUnique({
    where: { id: pagoId },
    include: pagoInclude,
  });
  if (!pago || pago.estado !== "reportado")
    throw new Error("Este pago ya fue resuelto o no existe");
  if (pago.receptorId !== receptorId)
    throw new Error("Solo quien recibe el dinero puede confirmar el pago");

  const result = await prisma.pago.updateMany({
    where: { id: pagoId, receptorId, estado: "reportado" },
    data: {
      estado: confirmar ? "exitoso" : "rechazado",
      fechaResolucion: new Date(),
    },
  });
  if (result.count !== 1)
    throw new Error("Este pago ya fue resuelto. Actualiza el grupo.");
  return prisma.pago.findUnique({
    where: { id: pagoId },
    include: pagoInclude,
  });
}

export async function getHistorial(usuarioId: string) {
  return prisma.pago.findMany({
    where: { OR: [{ pagadorId: usuarioId }, { receptorId: usuarioId }] },
    include: pagoInclude,
    orderBy: { fechaPago: "desc" },
  });
}
