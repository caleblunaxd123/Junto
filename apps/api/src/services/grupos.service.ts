import { randomBytes } from 'crypto';
import { UserError as Error } from '../domain/errors';
import { prisma } from '../lib/prisma';
import { calcularSaldosGrupo, resumenCuentasGrupo } from './balance.service';
import type { CrearGrupoInput, EditarGrupoInput } from '../schemas/grupos.schema';
import { saveJoinNotices, pushJoinNotice } from './groupNotices.service';
import { takeFreeParts } from './billParts.service';
import { allocateParts, nextPart, partsSummary } from '../domain/billParts';
import { unreadInGroup } from './groupChat.service';
import { transactionLock } from '../lib/transactionLock';
import { crearSinCuenta, heredar, tieneDineroPorRecibir } from './integrantes.service';

function generateLinkInvitacion(): string {
  return randomBytes(12).toString('base64url');
}

export async function crearGrupo(input: CrearGrupoInput, creadoPor: string) {
  const { cuenta, integrantes, ...datos } = input;
  // Group and bill together: never a group with half a bill.
  return prisma.$transaction(async (tx) => {
    await transactionLock(tx, `account-membership:${creadoPor}`);
    if (!(await tx.usuario.count({ where: { id: creadoPor, activo: true } }))) throw new Error('Tu cuenta ya no está activa. Inicia sesión nuevamente.', 401);
    const grupo = await tx.grupo.create({
      data: {
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tipo: datos.tipo,
        moneda: datos.moneda,
        pais: datos.pais,
        aprobacionPagos: datos.aprobacionPagos,
        modo: datos.modo,
        fechaLimite: datos.fechaLimite ? new Date(datos.fechaLimite) : undefined,
        creadoPor,
        linkInvitacion: generateLinkInvitacion(),
        miembros: {
          create: {
            usuarioId: creadoPor,
            rol: 'admin',
          },
        },
      },
      include: {
        miembros: {
          include: { usuario: { select: { id: true, nombre: true, email: true, fotoUrl: true } } },
        },
      },
    });
    if (integrantes?.length) await crearSinCuenta(tx, grupo.id, integrantes);
    if (cuenta) {
      await tx.gasto.create({
        data: {
          grupoId: grupo.id,
          descripcion: cuenta.descripcion || datos.nombre,
          montoTotal: cuenta.montoTotal,
          pagadoPor: creadoPor,
          creadoPor,
          partes: cuenta.partes,
          participantes: { create: allocateParts(cuenta.montoTotal, cuenta.partes, creadoPor, [creadoPor]) },
        },
      });
    }
    return grupo;
  });
}

/** The group's bill in parts (the oldest one), with how many parts are still free. */
export async function cuentaPorPartes(grupoId: string) {
  return (await cuentasPorPartes(grupoId))[0] ?? null;
}

export async function cuentasPorPartes(grupoId: string) {
  const bills = await prisma.gasto.findMany({
    where: { grupoId, activo: true, partes: { not: null } },
    orderBy: { fecha: 'asc' },
    include: { participantes: { select: { usuarioId: true, montoAsignado: true } }, pagador: { select: { nombre: true } } },
  });
  return bills.map((bill) => ({
    id: bill.id,
    descripcion: bill.descripcion,
    montoTotal: bill.montoTotal,
    pagadoPor: bill.pagadoPor,
    pagadorNombre: bill.pagador.nombre,
    participantes: bill.participantes,
    ...partsSummary(bill.montoTotal, bill.partes!, bill.pagadoPor, bill.participantes),
  }));
}

/** Only the cost of joining is disclosed, never other members' allocations or balances. */
export async function partesAlUnirse(grupoId: string, usuarioId: string) {
  const bills = await cuentasPorPartes(grupoId);
  const payers = await prisma.grupoMiembro.findMany({ where: { grupoId, activo: true, usuarioId: { in: bills.map((bill) => bill.pagadoPor) } }, select: { usuarioId: true } });
  const active = new Set(payers.map((payer) => payer.usuarioId));
  const cuentas = bills.flatMap((bill) => {
    const parte = active.has(bill.pagadoPor) ? nextPart(bill.montoTotal, bill.partes, bill.pagadoPor, bill.participantes, usuarioId) : null;
    return parte === null ? [] : [{ descripcion: bill.descripcion, parte, pagadorNombre: bill.pagadorNombre.trim().split(/\s+/)[0] }];
  });
  return { total: cuentas.reduce((sum, bill) => sum + bill.parte, 0), cuentas };
}

export async function getGruposUsuario(usuarioId: string) {
  const memberships = await prisma.grupoMiembro.findMany({
    where: { usuarioId, activo: true },
    include: {
      grupo: {
        include: {
          miembros: {
            where: { activo: true },
            include: {
              usuario: { select: { id: true, nombre: true, email: true, fotoUrl: true, sinCuenta: true } },
            },
          },
        },
      },
    },
  });

  // Calculate balance per group for this user
  const grupos = await Promise.all(
    memberships
      .filter((m) => m.grupo.activo)
      .map(async (m) => {
        const resumen = await resumenCuentasGrupo(m.grupo.id);
        const saldos = resumen.saldos;
        const teDeben = saldos
          .filter((s) => s.acreedorId === usuarioId)
          .reduce((acc, s) => acc + s.monto, 0);
        const debes = saldos
          .filter((s) => s.deudorId === usuarioId)
          .reduce((acc, s) => acc + s.monto, 0);

        return {
          ...m.grupo,
          miembros: m.grupo.miembros,
          balanceUsuario: { teDeben, debes, neto: teDeben - debes },
          resumen,
          rolUsuario: m.rol,
          // Unread chat items since the last visit (or since joining).
          noLeidos: await unreadInGroup(m.grupo.id, usuarioId, m.ultimaLectura ?? m.fechaUnion),
        };
      })
  );

  return grupos;
}

export async function editarGrupo(grupoId: string, input: EditarGrupoInput, usuarioId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    // Relation filters on UPDATE may have been evaluated before waiting for a row lock.
    const admin = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId, activo: true, rol: 'admin', usuario: { activo: true }, grupo: { activo: true } }, select: { id: true } });
    if (!admin) throw new Error('Solo un administrador activo puede editar este grupo.', 403);
    await tx.grupo.update({
      where: { id: grupoId },
      data: { ...input, fechaLimite: input.fechaLimite === undefined ? undefined : input.fechaLimite && new Date(input.fechaLimite) },
    });
  });
  return getGrupoDetalle(grupoId, usuarioId);
}

export async function getGrupoDetalle(grupoId: string, usuarioId: string) {
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId, activo: true },
  });

  if (!miembro) throw new Error('No perteneces a este grupo');

  const grupo = await prisma.grupo.findUnique({
    where: { id: grupoId },
    include: {
      miembros: {
        where: { activo: true },
        include: {
          usuario: { select: { id: true, nombre: true, email: true, celular: true, fotoUrl: true, sinCuenta: true } },
        },
      },
    },
  });

  if (!grupo || !grupo.activo) throw new Error('Grupo no encontrado');
  // The pinned message, shown above the chat.
  const fijado = grupo.mensajeFijadoId
    ? await prisma.comentario.findFirst({ where: { id: grupo.mensajeFijadoId, grupoId, eliminado: false }, select: { id: true, texto: true, fechaCreacion: true, autor: { select: { id: true, nombre: true } } } })
    : null;

  const resumen = await resumenCuentasGrupo(grupoId);
  const neto = resumen.cuentas.find((account) => account.usuarioId === usuarioId)?.neto || 0;
  // Every payment waiting for confirmation in the group, not only the viewer's: shared summaries cite it.
  const [pagosPorConfirmar, cuentasPorPartesDelGrupo] = await Promise.all([prisma.pago.count({ where: { grupoId, estado: 'reportado' } }), cuentasPorPartes(grupoId)]);
  return { ...grupo, resumen, saldos: resumen.saldos, pagosPorConfirmar, cuenta: cuentasPorPartesDelGrupo[0] ?? null, mensajeFijado: fijado, cuentasPorPartes: cuentasPorPartesDelGrupo, balanceUsuario: { neto, teDeben: Math.max(neto, 0), debes: Math.max(-neto, 0) }, rolUsuario: miembro.rol };
}

/**
 * An invitation code is either the group's link or the personal code of someone added by name
 * ("Ana"): joining with it means being Ana in the group.
 */
export async function resolverCodigo(code: string) {
  const grupo = await prisma.grupo.findFirst({ where: { linkInvitacion: code, activo: true } });
  if (grupo) return { grupo, personal: null };
  const member = await prisma.grupoMiembro.findFirst({
    where: { codigoPersonal: code, activo: true, grupo: { activo: true }, usuario: { sinCuenta: true, activo: true } },
    include: { grupo: true, usuario: { select: { id: true, nombre: true } } },
  });
  return member ? { grupo: member.grupo, personal: member.usuario } : null;
}

/** `como`: with the group link, the name-only member this person says they are (only if they owe). */
export async function unirseConLink(code: string, usuarioId: string, como?: string) {
  const resolved = await resolverCodigo(code);
  if (!resolved) throw new Error('Link de invitación inválido');
  const { grupo } = resolved;

  const joined = await prisma.$transaction(async (tx) => {
    await transactionLock(tx, `account-membership:${usuarioId}`);
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupo.id}::uuid FOR UPDATE`;
    if (!(await tx.usuario.count({ where: { id: usuarioId, activo: true, sinCuenta: false } }))) throw new Error('Tu cuenta ya no está activa. Inicia sesión nuevamente.', 401);
    // Re-read under the lock: the link may have been rotated or the personal code already used.
    const still = resolved.personal
      ? await tx.grupoMiembro.count({ where: { grupoId: grupo.id, codigoPersonal: code, activo: true, usuarioId: resolved.personal.id } })
      : await tx.grupo.count({ where: { id: grupo.id, linkInvitacion: code, activo: true } });
    if (!still) throw new Error(resolved.personal ? 'Este enlace personal ya se usó. Pide el enlace del grupo.' : 'Link de invitación inválido', 409);
    const takeover = resolved.personal?.id ?? como;
    // Choosing a name with the shared link is fine while that person only owes; someone owed
    // money (they paid something) can only be claimed with their personal link or by an admin.
    if (!resolved.personal && como && (await tieneDineroPorRecibir(tx, grupo.id, como)))
      throw new Error('A esa persona le deben dinero en el grupo: pide tu enlace personal a quien te agregó.', 403);
    const invitation = await tx.invitacion.findFirst({ where: { grupoId: grupo.id, invitadoId: usuarioId, estado: 'pendiente' }, select: { invitadoPor: true } });
    const member = await tx.grupoMiembro.findUnique({ where: { grupoId_usuarioId: { grupoId: grupo.id, usuarioId } } });
    // Rejoining through the link never restores an old admin role.
    if (!member) await tx.grupoMiembro.create({ data: { grupoId: grupo.id, usuarioId, rol: 'miembro' } });
    else if (!member.activo) await tx.grupoMiembro.update({ where: { id: member.id }, data: { activo: true, rol: 'miembro', fechaUnion: new Date() } });
    // A pending invitation to this group is answered by joining.
    await tx.invitacion.updateMany({ where: { grupoId: grupo.id, invitadoId: usuarioId, estado: 'pendiente' }, data: { estado: 'aceptada', fechaRespuesta: new Date() } });
    if (takeover) await heredar(tx, grupo.id, takeover, usuarioId);
    if (member?.activo) return { recipients: [] as string[], parte: 0 };
    // Taking over a name already in the expenses; otherwise the old "free parts" bills still apply.
    const parte = takeover ? 0 : await takeFreeParts(tx, grupo.id, usuarioId);
    return { recipients: await saveJoinNotices(tx, grupo.id, usuarioId, invitation?.invitadoPor, parte), parte };
  });
  void pushJoinNotice(grupo.id, usuarioId, joined.recipients, joined.parte);

  return { grupoId: grupo.id, nombre: grupo.nombre, parte: joined.parte };
}

export async function salirDeGrupo(grupoId: string, usuarioId: string) {
  await prisma.$transaction(async (tx) => {
    // Same lock as reporting a payment: nobody can add a payment involving you while you leave.
    await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
    const miembro = await tx.grupoMiembro.findFirst({
      where: { grupoId, usuarioId, activo: true },
    });
    if (!miembro) throw new Error('No perteneces a este grupo');

    // Check balance is 0 before leaving
    const saldos = await calcularSaldosGrupo(grupoId, tx);
    const tieneDeuda = saldos.some(
      (s) => (s.deudorId === usuarioId || s.acreedorId === usuarioId) && s.monto > 0
    );
    if (tieneDeuda) throw new Error('Debes saldar tus deudas antes de salir del grupo');
    // A payment waiting for an answer would be stuck: nobody outside the group can confirm it.
    const pendientes = await tx.pago.count({ where: { grupoId, estado: 'reportado', OR: [{ pagadorId: usuarioId }, { receptorId: usuarioId }] } });
    if (pendientes) throw new Error('Tienes un pago esperando confirmación en este grupo. Resuélvanlo antes de salir.');

    // People added by name cannot run the group: only members with an account count here.
    const otros = await tx.grupoMiembro.findMany({
      where: { grupoId, activo: true, usuarioId: { not: usuarioId }, usuario: { sinCuenta: false } },
      orderBy: { fechaUnion: 'asc' },
    });
    if (!otros.length) {
      // Nobody else can see this group any more: close it and its invitation link.
      await tx.grupo.update({ where: { id: grupoId }, data: { activo: false, linkInvitacion: null } });
    } else if (miembro.rol === 'admin' && !otros.some((otro) => otro.rol === 'admin')) {
      // A group must never be left without an administrator: hand the role to the longest-standing member.
      await tx.grupoMiembro.update({ where: { id: otros[0].id }, data: { rol: 'admin' } });
    }
    await tx.grupoMiembro.update({
      where: { id: miembro.id },
      data: { activo: false, rol: 'miembro' },
    });
  });
}
