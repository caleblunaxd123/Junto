import { prisma } from '../lib/prisma';
import { sendPushNotification } from '../lib/firebase';
import type { CrearGastoInput } from '../schemas/gastos.schema';

export async function crearGasto(grupoId: string, input: CrearGastoInput, creadoPor: string) {
  // Verify creator is a group member
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: creadoPor, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  // Calculate participant amounts based on split type
  const participanteData = calcularParticipantes(input);

  const gasto = await prisma.gasto.create({
    data: {
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
        include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } },
      },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });

  // Send notifications to participants (non-blocking)
  notificarParticipantes(gasto, creadoPor).catch((err) =>
    console.error('[Notification] Failed to notify participants:', err)
  );

  return gasto;
}

function calcularParticipantes(input: CrearGastoInput) {
  const { tipoDivision, montoTotal, participantes } = input;

  if (tipoDivision === 'igual') {
    const montoPorPersona = Math.round(montoTotal / participantes.length);
    const resto = montoTotal - montoPorPersona * participantes.length;

    return participantes.map((p, idx) => ({
      usuarioId: p.usuarioId,
      montoAsignado: idx === 0 ? montoPorPersona + resto : montoPorPersona, // first person absorbs remainder
    }));
  }

  if (tipoDivision === 'exacto') {
    const total = participantes.reduce((acc, p) => acc + (p.monto || 0), 0);
    if (Math.abs(total - montoTotal) > 1) {
      throw new Error(`La suma de montos exactos (${total}) no coincide con el total (${montoTotal})`);
    }
    return participantes.map((p) => ({
      usuarioId: p.usuarioId,
      montoAsignado: p.monto || 0,
    }));
  }

  if (tipoDivision === 'porcentaje') {
    const totalPct = participantes.reduce((acc, p) => acc + (p.porcentaje || 0), 0);
    if (Math.abs(totalPct - 100) > 0.01) {
      throw new Error(`Los porcentajes deben sumar 100 (actual: ${totalPct})`);
    }
    return participantes.map((p) => ({
      usuarioId: p.usuarioId,
      montoAsignado: Math.round((montoTotal * (p.porcentaje || 0)) / 100),
    }));
  }

  throw new Error('Tipo de división inválido');
}

async function notificarParticipantes(
  gasto: Awaited<ReturnType<typeof prisma.gasto.create>> & {
    participantes: Array<{ usuario: { id: string; nombre: string; fotoUrl: string | null } & { expoPushToken?: string | null }; montoAsignado: number }>;
    pagador: { id: string; nombre: string };
  },
  creadoPor: string
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
        'Nuevo gasto registrado',
        `${pagadorNombre} registró ${gasto.descripcion}: te tocan S/${montoParte}`,
        { grupoId: gasto.grupoId, gastoId: gasto.id, type: 'nuevo_gasto' }
      );
    }
  }
}

export async function getGastosGrupo(grupoId: string, usuarioId: string, page = 1) {
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  const PAGE_SIZE = 20;
  const skip = (page - 1) * PAGE_SIZE;

  const [gastos, total] = await Promise.all([
    prisma.gasto.findMany({
      where: { grupoId, activo: true },
      include: {
        participantes: {
          include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } },
        },
        pagador: { select: { id: true, nombre: true, fotoUrl: true } },
        creador: { select: { id: true, nombre: true } },
      },
      orderBy: { fecha: 'desc' },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.gasto.count({ where: { grupoId, activo: true } }),
  ]);

  return { gastos, total, page, pageSize: PAGE_SIZE, totalPages: Math.ceil(total / PAGE_SIZE) };
}

export async function getGastoDetalle(gastoId: string, usuarioId: string) {
  const gasto = await prisma.gasto.findUnique({
    where: { id: gastoId },
    include: {
      participantes: {
        include: { usuario: { select: { id: true, nombre: true, fotoUrl: true } } },
      },
      pagador: { select: { id: true, nombre: true, fotoUrl: true } },
      creador: { select: { id: true, nombre: true } },
    },
  });

  if (!gasto || !gasto.activo) throw new Error('Gasto no encontrado');

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error('No tienes acceso a este gasto');

  return gasto;
}

export async function editarGasto(gastoId: string, input: Partial<CrearGastoInput>, usuarioId: string) {
  const gasto = await prisma.gasto.findUnique({ where: { id: gastoId } });
  if (!gasto || !gasto.activo) throw new Error('Gasto no encontrado');

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  const esCreador = gasto.creadoPor === usuarioId;
  const esAdmin = miembro?.rol === 'admin';

  if (!esCreador && !esAdmin) throw new Error('No tienes permisos para editar este gasto');

  const updatedGasto = await prisma.gasto.update({
    where: { id: gastoId },
    data: {
      descripcion: input.descripcion,
      montoTotal: input.montoTotal,
      pagadoPor: input.pagadoPor,
      categoria: input.categoria,
      notas: input.notas,
    },
    include: {
      participantes: { include: { usuario: { select: { id: true, nombre: true } } } },
      pagador: { select: { id: true, nombre: true } },
    },
  });

  // If participants changed, recalculate
  if (input.participantes && input.montoTotal && input.tipoDivision) {
    const participanteData = calcularParticipantes(input as CrearGastoInput);
    await prisma.gastoParticipante.deleteMany({ where: { gastoId } });
    await prisma.gastoParticipante.createMany({
      data: participanteData.map((p) => ({ ...p, gastoId })),
    });
  }

  return updatedGasto;
}

export async function eliminarGasto(gastoId: string, usuarioId: string) {
  const gasto = await prisma.gasto.findUnique({ where: { id: gastoId } });
  if (!gasto || !gasto.activo) throw new Error('Gasto no encontrado');

  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId: gasto.grupoId, usuarioId, activo: true },
  });
  const esCreador = gasto.creadoPor === usuarioId;
  const esAdmin = miembro?.rol === 'admin';

  if (!esCreador && !esAdmin) throw new Error('No tienes permisos para eliminar este gasto');

  await prisma.gasto.update({ where: { id: gastoId }, data: { activo: false } });
}
