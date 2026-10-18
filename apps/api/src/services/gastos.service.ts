import { formatMoney } from "@junto/shared/currency";
import { describeError } from "../lib/logSafe";
import { prisma } from "../lib/prisma";
import { UserError as Error } from "../domain/errors";
import { sendPushNotification } from "../lib/firebase";
import type { CrearGastoInput } from "../schemas/gastos.schema";
import {
  allocateEqual,
  allocateExact,
  allocatePercentages,
  allocateShares,
} from "../domain/money";
import { validatePayers } from '../domain/expensePayers';
import { allocateParts } from "../domain/billParts";
import type { Prisma } from "@prisma/client";
import { requireOpenGroup, groupEvent } from './groupLifecycle.service';
import { expenseNoticeText, saveExpenseNotices } from './groupNotices.service';

export async function crearGasto(
  grupoId: string,
  input: CrearGastoInput,
  creadoPor: string,
  // A recurring rule creating its occurrence: the expense keeps a link to it.
  origen?: { recurrenteId: string; occurrence: string; next: string },
) {
  const participanteData = calcularParticipantes(input);
  const pagadores = validatePayers(input);
  if (input.partes !== undefined && input.pagadores) throw new Error('Las cuentas antiguas por partes admiten un solo pagador. Usa un gasto con integrantes definidos.');
  let result;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
      const miembro = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: creadoPor, activo: true, grupo: { activo: true } } });
      if (!miembro) throw new Error("No perteneces a este grupo");
      if (origen) {
        // The group lock also serializes pause/delete/resume and closure with each occurrence.
        const rule = await tx.gastoRecurrente.findUnique({ where: { id: origen.recurrenteId } });
        if (!rule?.activo || rule.grupoId !== grupoId || rule.proximaFecha.toISOString().slice(0, 10) !== origen.occurrence)
          throw new Error('La programación cambió mientras se generaba el gasto.', 409, 'RECURRENCE_CHANGED');
      }
      const previo = await gastoPorSolicitud(grupoId, input, creadoPor, tx);
      if (previo) {
        if (origen) await tx.gastoRecurrente.update({ where: { id: origen.recurrenteId }, data: { proximaFecha: new Date(`${origen.next}T00:00:00Z`) } });
        return { gasto: previo, repetido: true };
      }
      await requireOpenGroup(tx, grupoId);
      await validarMiembros(grupoId, input.pagadoPor, [...input.participantes.map((p) => p.usuarioId), ...pagadores.map(p => p.usuarioId)], tx);
      const gasto = await tx.gasto.create({
        data: {
          solicitudId: input.solicitudId,
          grupoId,
          descripcion: input.descripcion,
          montoTotal: input.montoTotal,
          pagadoPor: input.pagadoPor,
          categoria: input.categoria,
          partes: input.partes,
          creadoPor,
          notas: input.notas,
          fecha: input.fecha ? new Date(input.fecha) : new Date(),
          recurrenteId: origen?.recurrenteId,
          participantes: { create: participanteData },
          ...(input.pagadores ? { pagadores: { create: pagadores } } : {}),
        },
        include: {
          participantes: {
            include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } },
          },
          pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      pagadores: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } }, orderBy: { usuarioId: 'asc' } },
          creador: { select: { id: true, nombre: true } },
        },
      });
      await saveExpenseNotices(tx, { id: gasto.id, grupoId, creadoPor, participantes: participanteData });
      // Expense and next date commit together: a crash cannot leave a half-advanced rule.
      if (origen) await tx.gastoRecurrente.update({ where: { id: origen.recurrenteId }, data: { proximaFecha: new Date(`${origen.next}T00:00:00Z`) } });
      return { gasto, repetido: false };
    });
  } catch (error) {
    // Two identical requests raced: the unique key let only one in.
    const ganador = (error as { code?: string }).code === "P2002" ? await gastoPorSolicitud(grupoId, input, creadoPor) : null;
    if (ganador) return { gasto: ganador, repetido: true };
    throw error;
  }

  // Send notifications to participants (non-blocking)
  if (!result.repetido) await notificarParticipantes(result.gasto, creadoPor).catch((err) =>
    console.error("[Notification] Failed to notify participants:", describeError(err)),
  );
  return result;
}

async function gastoPorSolicitud(grupoId: string, input: CrearGastoInput, creadoPor: string, db: Prisma.TransactionClient = prisma) {
  if (!input.solicitudId) return null;
  const previo = await db.gasto.findUnique({
    where: { creadoPor_solicitudId: { creadoPor, solicitudId: input.solicitudId } },
    include: {
      participantes: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } } },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      pagadores: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } }, orderBy: { usuarioId: 'asc' } },
      creador: { select: { id: true, nombre: true } },
    },
  });
  if (!previo) return null;
  const allocation = calcularParticipantes(input);
  const requestedPayers = validatePayers(input);
  const savedPayers = previo.pagadores.length ? previo.pagadores : [{ usuarioId: previo.pagadoPor, monto: previo.montoTotal }];
  const samePayers = savedPayers.length === requestedPayers.length && requestedPayers.every(p => savedPayers.some(saved => saved.usuarioId === p.usuarioId && saved.monto === p.monto));
  const sameParts = previo.participantes.length === allocation.length && allocation.every((part) =>
    previo.participantes.some((saved) => saved.usuarioId === part.usuarioId && saved.montoAsignado === part.montoAsignado),
  );
  if (!previo.activo || previo.grupoId !== grupoId || previo.montoTotal !== input.montoTotal || previo.descripcion !== input.descripcion || previo.pagadoPor !== input.pagadoPor ||
    previo.categoria !== input.categoria || previo.partes !== (input.partes ?? null) || (previo.notas ?? "") !== (input.notas ?? "") ||
    (input.fecha !== undefined && previo.fecha.getTime() !== new Date(input.fecha).getTime()) || !sameParts || !samePayers)
    throw new Error("Este envío ya guardó un gasto distinto. Revisa los gastos del grupo antes de volver a guardar.", 409);
  return previo;
}

export function calcularParticipantes(input: CrearGastoInput) {
  const { tipoDivision, montoTotal, participantes } = input;

  if (input.partes !== undefined) {
    if (tipoDivision !== "igual") throw new Error("Una cuenta por partes se reparte en partes iguales.");
    return allocateParts(montoTotal, input.partes, input.pagadoPor, participantes.map((p) => p.usuarioId));
  }

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

  if (tipoDivision === "participaciones") {
    if (participantes.some((p) => p.participaciones === undefined)) throw new Error("Indica cuántas participaciones tiene cada persona. Usa 0 si no le corresponde pagar.");
    return allocateShares(
      montoTotal,
      participantes.map((p) => ({
        usuarioId: p.usuarioId,
        participaciones: p.participaciones ?? 0,
      })),
    );
  }

  throw new Error("Tipo de división inválido");
}

export async function validarMiembros(
  grupoId: string,
  pagadoPor: string,
  participanteIds: string[],
  db: Prisma.TransactionClient = prisma,
) {
  const ids = [...new Set([pagadoPor, ...participanteIds])];
  const miembros = await db.grupoMiembro.findMany({
    where: { grupoId, usuarioId: { in: ids }, activo: true, usuario: { activo: true }, grupo: { activo: true } },
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
    creador?: { id: string; nombre: string };
    pagadores?: Array<{ usuario: { nombre: string } }>;
  },
  creadoPor: string,
) {
  const actorNombre = gasto.creador?.nombre || gasto.pagador.nombre;
  const { moneda } = await prisma.grupo.findUniqueOrThrow({ where: { id: gasto.grupoId }, select: { moneda: true } });

  for (const participante of gasto.participantes) {
    if (participante.usuario.id === creadoPor || participante.montoAsignado <= 0) continue;

    const usuario = await prisma.usuario.findFirst({
      where: { id: participante.usuario.id, activo: true, sinCuenta: false },
      select: { expoPushToken: true },
    });

    if (usuario?.expoPushToken) {
      await sendPushNotification(
        usuario.expoPushToken,
        "Nuevo gasto registrado",
        expenseNoticeText(actorNombre, gasto.descripcion, participante.montoAsignado, moneda),
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
      pagadores: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } }, orderBy: { usuarioId: 'asc' } },
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

export async function getGastoDetalle(gastoId: string, usuarioId: string, db: Prisma.TransactionClient = prisma) {
  const gasto = await db.gasto.findUnique({
    where: { id: gastoId },
    include: {
      grupo: { select: { moneda: true } },
      participantes: {
        // Stable order: the shared summary (app preview and e-mail) must list people identically.
        orderBy: { id: "asc" },
        include: {
          usuario: { select: { id: true, nombre: true, fotoUrl: true } },
        },
      },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      pagadores: { include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } }, orderBy: { usuarioId: 'asc' } },
      creador: { select: { id: true, nombre: true } },
    },
  });

  if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");

  const miembro = await db.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true, grupo: { activo: true } },
  });
  if (!miembro) throw new Error("No tienes acceso a este gasto");

  return gasto;
}

/**
 * True when someone in this expense (who paid or who shares it) is no longer an active member.
 * Changing its money would move debts that person can no longer see or settle.
 */
async function involvesFormerMembers(gasto: { id: string; grupoId: string; pagadoPor: string }, tx: Prisma.TransactionClient) {
  const participantes = await tx.gastoParticipante.findMany({ where: { gastoId: gasto.id }, select: { usuarioId: true } });
  const pagadores = await tx.gastoAporte.findMany({ where: { gastoId: gasto.id }, select: { usuarioId: true } });
  const ids = [...new Set([gasto.pagadoPor, ...pagadores.map(p => p.usuarioId), ...participantes.map((p) => p.usuarioId)])];
  const activos = await tx.grupoMiembro.count({ where: { grupoId: gasto.grupoId, usuarioId: { in: ids }, activo: true, usuario: { activo: true } } });
  return activos !== ids.length;
}
const FORMER_MEMBER = "Este gasto incluye a alguien que ya no está en el grupo: cambiar su monto, quién pagó o eliminarlo movería deudas que esa persona ya no puede saldar. Puedes corregir la descripción, la categoría, la fecha o la nota.";

export async function editarGasto(
  gastoId: string,
  input: Partial<CrearGastoInput>,
  usuarioId: string,
) {
  const target = await prisma.gasto.findUnique({ where: { id: gastoId }, select: { grupoId: true } });
  if (!target) throw new Error("Gasto no encontrado");
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${target.grupoId}::uuid FOR UPDATE`;
    const gasto = await tx.gasto.findUnique({ where: { id: gastoId } });
    if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");
    const miembro = await tx.grupoMiembro.findFirst({
      where: { grupoId: gasto.grupoId, usuarioId, activo: true, grupo: { activo: true } },
    });
    // Like a shared notebook, anyone in the group can correct an expense (someone paid more, or
    // dropped out). Every change is kept with its before/after in the group's history.
    if (!miembro) throw new Error("No tienes permisos para editar este gasto");
    await requireOpenGroup(tx, gasto.grupoId);
    const antes = await expenseSnapshot(tx, gastoId);

    const cambiaDivision =
      input.montoTotal !== undefined ||
      input.participantes !== undefined ||
      input.tipoDivision !== undefined ||
      input.partes !== undefined;
    if (
      cambiaDivision &&
      (!input.montoTotal || !input.participantes || !input.tipoDivision)
    ) {
      throw new Error(
        "Para cambiar el monto o la división, envía el monto total, el tipo y todas las personas",
      );
    }

    const savedPayers = await tx.gastoAporte.findMany({ where: { gastoId } });
    const changesMoney = cambiaDivision || input.pagadoPor !== undefined || input.pagadores !== undefined;
    // Old APKs must not silently replace a multi-payer expense with their single payer field.
    if (savedPayers.length > 1 && changesMoney && input.pagadores === undefined)
      throw new Error('Este gasto tiene varios pagadores. Actualiza JUNTO para cambiar sus importes o participantes.', 409);
    const nextPayers = validatePayers({ montoTotal: input.montoTotal ?? gasto.montoTotal, pagadoPor: input.pagadoPor ?? gasto.pagadoPor,
      pagadores: input.pagadores ?? (!changesMoney && savedPayers.length ? savedPayers : undefined) });
    if (input.pagadores && (input.partes ?? gasto.partes) !== null && (input.partes ?? gasto.partes) !== undefined)
      throw new Error('Cambia primero la cuenta por partes a un gasto con integrantes definidos.');
    if ((input.pagadores !== undefined || cambiaDivision || (input.pagadoPor && input.pagadoPor !== gasto.pagadoPor)) && (await involvesFormerMembers(gasto, tx)))
      throw new Error(FORMER_MEMBER, 409);

    if (changesMoney) {
      await validarMiembros(
        gasto.grupoId,
        input.pagadoPor ?? gasto.pagadoPor,
        [...(input.participantes?.map((participante) => participante.usuarioId) ?? []), ...nextPayers.map(p => p.usuarioId)],
        tx,
      );
    }

    const participanteData = cambiaDivision
      ? calcularParticipantes({ ...input, pagadoPor: input.pagadoPor ?? gasto.pagadoPor } as CrearGastoInput)
      : null;
    await tx.gasto.update({
      where: { id: gastoId },
      data: {
        descripcion: input.descripcion,
        montoTotal: input.montoTotal,
        pagadoPor: input.pagadoPor,
        categoria: input.categoria,
        // A split changed without parts is fixed by hand: newcomers no longer take parts automatically.
        partes: cambiaDivision ? (input.partes ?? null) : undefined,
        notas: input.notas,
        fecha: input.fecha ? new Date(input.fecha) : undefined,
      },
    });
    if (changesMoney) {
      await tx.gastoAporte.deleteMany({ where: { gastoId } });
      if (input.pagadores) await tx.gastoAporte.createMany({ data: nextPayers.map(p => ({ ...p, gastoId })) });
    }
    if (participanteData) {
      await tx.gastoParticipante.deleteMany({ where: { gastoId } });
      await tx.gastoParticipante.createMany({
        data: participanteData.map((participante) => ({
          ...participante,
          gastoId,
        })),
      });
    }
    const despues = await expenseSnapshot(tx, gastoId);
    if (JSON.stringify(antes) !== JSON.stringify(despues)) {
      const { moneda } = await tx.grupo.findUniqueOrThrow({ where: { id: gasto.grupoId }, select: { moneda: true } });
      await groupEvent(tx, gasto.grupoId, usuarioId, 'gasto_editado', antes.montoTotal !== despues.montoTotal
        ? `Se corrigió «${despues.descripcion}»: de ${formatMoney(antes.montoTotal, moneda)} a ${formatMoney(despues.montoTotal, moneda)}.`
        : `Se corrigió «${despues.descripcion}».`, { gastoId, antes, despues });
    }
    return getGastoDetalle(gastoId, usuarioId, tx);
  });
}

export async function eliminarGasto(gastoId: string, usuarioId: string) {
  const target = await prisma.gasto.findUnique({ where: { id: gastoId }, select: { grupoId: true } });
  if (!target) throw new Error("Gasto no encontrado");
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${target.grupoId}::uuid FOR UPDATE`;
    const gasto = await tx.gasto.findUnique({ where: { id: gastoId } });
    if (!gasto || !gasto.activo) throw new Error("Gasto no encontrado");
    const miembro = await tx.grupoMiembro.findFirst({
      where: { grupoId: gasto.grupoId, usuarioId, activo: true, grupo: { activo: true } },
    });
    const esCreador = gasto.creadoPor === usuarioId;
    const esAdmin = miembro?.rol === "admin";

    if (!miembro || (!esCreador && !esAdmin))
      throw new Error("No tienes permisos para eliminar este gasto");
    await requireOpenGroup(tx, gasto.grupoId);
    if (await involvesFormerMembers(gasto, tx)) throw new Error(FORMER_MEMBER, 409);

    await tx.gasto.update({
      where: { id: gastoId },
      data: { activo: false },
    });
    await groupEvent(tx, gasto.grupoId, usuarioId, 'gasto_eliminado', `Se eliminó «${gasto.descripcion}». Ya no cuenta en los saldos.`, { gastoId, antes: await expenseSnapshot(tx, gastoId) });
  });
}

async function expenseSnapshot(tx: Prisma.TransactionClient, id: string) {
  const expense = await tx.gasto.findUniqueOrThrow({ where: { id }, select: { descripcion: true, montoTotal: true, pagadoPor: true, categoria: true, fecha: true, notas: true, partes: true, pagadores: { select: { usuarioId: true, monto: true, concepto: true }, orderBy: { usuarioId: 'asc' } }, participantes: { select: { usuarioId: true, montoAsignado: true }, orderBy: { usuarioId: 'asc' } } } });
  return { ...expense, fecha: expense.fecha.toISOString() };
}
