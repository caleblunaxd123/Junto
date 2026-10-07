import { describeError } from "../lib/logSafe";
import { prisma } from "../lib/prisma";
import { UserError as Error } from "../domain/errors";
import { sendPushNotification } from "../lib/firebase";
import type { CrearGastoInput } from "../schemas/gastos.schema";
import {
  allocateEqual,
  allocateExact,
  allocatePercentages,
} from "../domain/money";

export async function crearGasto(
  grupoId: string,
  input: CrearGastoInput,
  creadoPor: string,
) {
  // Verify creator is a group member
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: creadoPor, activo: true },
  });
  if (!miembro) throw new Error("No perteneces a este grupo");

  await validarMiembros(
    grupoId,
    input.pagadoPor,
    input.participantes.map((p) => p.usuarioId),
  );

  const participanteData = calcularParticipantes(input);

  // Same key again (double tap, retry after a timeout): return what was already saved, never a copy.
  const previo = await gastoPorSolicitud(grupoId, input, creadoPor);
  if (previo) return { gasto: previo, repetido: true };

  let gasto;
  try {
  gasto = await prisma.gasto.create({
    data: {
      solicitudId: input.solicitudId,
      grupoId,
      descripcion: input.descripcion,
      montoTotal: input.montoTotal,
      pagadoPor: input.pagadoPor,
      categoria: input.categoria,
      creadoPor,
      notas: input.notas,
      fecha: input.fecha ? new Date(input.fecha) : new Date(),
      participantes: {
        create: participanteData,
      },
    },
    include: {
      participantes: {
        include: {
          usuario: { select: { id: true, nombre: true, fotoUrl: true } },
        },
      },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });
  } catch (error) {
    // Two identical requests raced: the unique key let only one in.
    const ganador = (error as { code?: string }).code === "P2002" ? await gastoPorSolicitud(grupoId, input, creadoPor) : null;
    if (ganador) return { gasto: ganador, repetido: true };
    throw error;
  }

  // Send notifications to participants (non-blocking)
  notificarParticipantes(gasto, creadoPor).catch((err) =>
    console.error("[Notification] Failed to notify participants:", describeError(err)),
  );

  return { gasto, repetido: false };
}

async function gastoPorSolicitud(grupoId: string, input: CrearGastoInput, creadoPor: string) {
  if (!input.solicitudId) return null;
  const previo = await prisma.gasto.findUnique({
    where: { creadoPor_solicitudId: { creadoPor, solicitudId: input.solicitudId } },
    include: {
      participantes: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } } },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });
  if (!previo) return null;
  if (previo.grupoId !== grupoId || previo.montoTotal !== input.montoTotal || previo.descripcion !== input.descripcion || previo.pagadoPor !== input.pagadoPor)
    throw new Error("Este envío ya guardó un gasto distinto. Revisa los gastos del grupo antes de volver a guardar.", 409);
  return previo;
}

function calcularParticipantes(input: CrearGastoInput) {
  const { tipoDivision, montoTotal, participantes } = input;

  if (tipoDivision === "igual") {
    return allocateEqual(
      montoTotal,
      participantes.map((p) => p.usuarioId),
    );
  }

  if (tipoDivision === "exacto") {
    if (participantes.some((p) => p.monto === undefined)) throw new Error("Indica el monto de cada persona. Usa 0 explícitamente si no le corresponde pagar.");
    return allocateExact(
      montoTotal,
      participantes.map((p) => ({
        usuarioId: p.usuarioId,
        monto: p.monto ?? 0,
      })),
    );
  }

  if (tipoDivision === "porcentaje") {
    if (participantes.some((p) => p.porcentaje === undefined)) throw new Error("Indica el porcentaje de cada persona. Usa 0 explícitamente si no le corresponde pagar.");
    return allocatePercentages(
      montoTotal,
      participantes.map((p) => ({
        usuarioId: p.usuarioId,
        porcentaje: p.porcentaje ?? 0,
      })),
    );
  }

  throw new Error("Tipo de división inválido");
}

async function validarMiembros(
  grupoId: string,
  pagadoPor: string,
  participanteIds: string[],
) {
  const ids = [...new Set([pagadoPor, ...participanteIds])];
  const miembros = await prisma.grupoMiembro.findMany({
    where: { grupoId, usuarioId: { in: ids }, activo: true },
    select: { usuarioId: true },
  });
  const activos = new Set(miembros.map((miembro) => miembro.usuarioId));
  const invalidos = ids.filter((id) => !activos.has(id));
  if (invalidos.length > 0) {
    throw new Error(
      "El pagador y todas las personas incluidas deben pertenecer al grupo",
    );
  }
}

async function notificarParticipantes(
  gasto: Awaited<ReturnType<typeof prisma.gasto.create>> & {
    participantes: Array<{
      usuario: { id: string; nombre: string; fotoUrl: string | null } & {
        expoPushToken?: string | null;
      };
      montoAsignado: number;
    }>;
    pagador: { id: string; nombre: string };
  },
  creadoPor: string,
) {
  const pagadorNombre = gasto.pagador.nombre;
  const montoSoles = (gasto.montoTotal / 100).toFixed(2);

  for (const participante of gasto.participantes) {
    if (participante.usuario.id === creadoPor) continue;

    const usuario = await prisma.usuario.findUnique({
      where: { id: participante.usuario.id },
      select: { expoPushToken: true },
    });

    if (usuario?.expoPushToken) {
      const montoParte = (participante.montoAsignado / 100).toFixed(2);
      await sendPushNotification(
        usuario.expoPushToken,
        "Nuevo gasto registrado",
        `${pagadorNombre} registró ${gasto.descripcion}: te tocan S/${montoParte}`,
        { grupoId: gasto.grupoId, gastoId: gasto.id, type: "nuevo_gasto" },
      );
    }
  }
}

export async function getGastosGrupo(
  grupoId: string,
  usuarioId: string,
  page = 1,
) {
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error("No perteneces a este grupo");

  const PAGE_SIZE = 20;
  const skip = (page - 1) * PAGE_SIZE;

  const [gastos, total] = await Promise.all([
    prisma.gasto.findMany({
      where: { grupoId, activo: true },
      include: {
        participantes: {
          include: {
            usuario: { select: { id: true, nombre: true, fotoUrl: true } },
          },
        },
        pagador: { select: { id: true, nombre: true, fotoUrl: true } },
        creador: { select: { id: true, nombre: true } },
        _count: { select: { comentarios: { where: { eliminado: false } } } },
      },
      orderBy: { fecha: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.gasto.count({ where: { grupoId, activo: true } }),
  ]);

  return {
    gastos,
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getGastoDetalle(gastoId: string, usuarioId: string) {
  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: {
      participantes: {
        // Stable order: the shared summary (app preview and e-mail) must list people identically.
        orderBy: { id: "asc" },
        include: {
          usuario: { select: { id: true, nombre: true, fotoUrl: true } },
        },
      },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });

  if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error("No tienes acceso a este gasto");

  return gasto;
}

export async function editarGasto(
  gastoId: string,
  input: Partial<CrearGastoInput>,
  usuarioId: string,
) {
  const gasto = await prisma.gasto.findUnique({ where: { id: gastoId } });
  if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  const esCreador = gasto.creadoPor === usuarioId;
  const esAdmin = miembro?.rol === "admin";

  if (!miembro || (!esCreador && !esAdmin))
    throw new Error("No tienes permisos para editar este gasto");

  const cambiaDivision =
    input.montoTotal !== undefined ||
    input.participantes !== undefined ||
    input.tipoDivision !== undefined;
  if (
    cambiaDivision &&
    (!input.montoTotal || !input.participantes || !input.tipoDivision)
  ) {
    throw new Error(
      "Para cambiar el monto o la división, envía el monto total, el tipo y todas las personas",
    );
  }

  if (input.pagadoPor || input.participantes) {
    await validarMiembros(
      gasto.grupoId,
      input.pagadoPor ?? gasto.pagadoPor,
      input.participantes?.map((participante) => participante.usuarioId) ?? [],
    );
  }

  const participanteData = cambiaDivision
    ? calcularParticipantes(input as CrearGastoInput)
    : null;
  await prisma.$transaction(async (tx) => {
    await tx.gasto.update({
      where: { id: gastoId },
      data: {
        descripcion: input.descripcion,
        montoTotal: input.montoTotal,
        pagadoPor: input.pagadoPor,
        categoria: input.categoria,
        notas: input.notas,
        fecha: input.fecha ? new Date(input.fecha) : undefined,
      },
    });
    if (participanteData) {
      await tx.gastoParticipante.deleteMany({ where: { gastoId } });
      await tx.gastoParticipante.createMany({
        data: participanteData.map((participante) => ({
          ...participante,
          gastoId,
        })),
      });
    }
  });

  return getGastoDetalle(gastoId, usuarioId);
}

export async function eliminarGasto(gastoId: string, usuarioId: string) {
  const gasto = await prisma.gasto.findUnique({ where: { id: gastoId } });
  if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  const esCreador = gasto.creadoPor === usuarioId;
  const esAdmin = miembro?.rol === "admin";

  if (!miembro || (!esCreador && !esAdmin))
    throw new Error("No tienes permisos para eliminar este gasto");

  await prisma.gasto.update({
    where: { id: gastoId },
    data: { activo: false },
  });
}
