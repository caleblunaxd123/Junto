import { randomBytes } from 'crypto';
import { UserError as Error } from '../domain/errors';
import { prisma } from '../lib/prisma';
import { calcularSaldosGrupo, resumenCuentasGrupo } from './balance.service';
import type { CrearGrupoInput, EditarGrupoInput } from '../schemas/grupos.schema';

function generateLinkInvitacion(): string {
  return randomBytes(12).toString('base64url');
}

export async function crearGrupo(input: CrearGrupoInput, creadoPor: string) {
  const grupo = await prisma.grupo.create({
    data: {
      nombre: input.nombre,
      descripcion: input.descripcion,
      tipo: input.tipo,
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

  return grupo;
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
              usuario: { select: { id: true, nombre: true, email: true, fotoUrl: true } },
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
        };
      })
  );

  return grupos;
}

export async function editarGrupo(grupoId: string, input: EditarGrupoInput, usuarioId: string) {
  const updated = await prisma.grupo.updateMany({
    where: {
      id: grupoId,
      activo: true,
      miembros: { some: { usuarioId, activo: true, rol: 'admin' } },
    },
    data: input,
  });
  if (!updated.count) throw new Error('Solo un administrador activo puede editar este grupo.', 403);
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
          usuario: { select: { id: true, nombre: true, email: true, celular: true, fotoUrl: true } },
        },
      },
    },
  });

  if (!grupo || !grupo.activo) throw new Error('Grupo no encontrado');

  const resumen = await resumenCuentasGrupo(grupoId);
  const neto = resumen.cuentas.find((account) => account.usuarioId === usuarioId)?.neto || 0;
  // Every payment waiting for confirmation in the group, not only the viewer's: shared summaries cite it.
  const pagosPorConfirmar = await prisma.pago.count({ where: { grupoId, estado: 'reportado' } });
  return { ...grupo, resumen, saldos: resumen.saldos, pagosPorConfirmar, balanceUsuario: { neto, teDeben: Math.max(neto, 0), debes: Math.max(-neto, 0) }, rolUsuario: miembro.rol };
}

export async function invitarPorCelular(grupoId: string, celular: string, invitadorId: string) {
  // Verify inviter is a member
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: invitadorId, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  const usuario = await prisma.usuario.findFirst({ where: { celular, activo: true } });
  if (!usuario) {
    return { found: false, mensaje: 'Usuario no encontrado. Comparte el link de invitación.' };
  }

  const yaEsMiembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId: usuario.id, activo: true },
  });
  if (yaEsMiembro) {
    return { found: true, alreadyMember: true, mensaje: 'Este usuario ya pertenece al grupo.' };
  }

  await prisma.grupoMiembro.upsert({
    where: { grupoId_usuarioId: { grupoId, usuarioId: usuario.id } },
    create: { grupoId, usuarioId: usuario.id, rol: 'miembro' },
    update: { activo: true },
  });

  return { found: true, alreadyMember: false, usuario: { id: usuario.id, nombre: usuario.nombre } };
}

export async function unirseConLink(linkInvitacion: string, usuarioId: string) {
  const grupo = await prisma.grupo.findFirst({ where: { linkInvitacion, activo: true } });
  if (!grupo) throw new Error('Link de invitación inválido');

  await prisma.grupoMiembro.upsert({
    where: { grupoId_usuarioId: { grupoId: grupo.id, usuarioId } },
    create: { grupoId: grupo.id, usuarioId, rol: 'miembro' },
    update: { activo: true },
  });

  return { grupoId: grupo.id, nombre: grupo.nombre };
}

export async function salirDeGrupo(grupoId: string, usuarioId: string) {
  const miembro = await prisma.grupoMiembro.findFirst({
    where: { grupoId, usuarioId, activo: true },
  });
  if (!miembro) throw new Error('No perteneces a este grupo');

  // Check balance is 0 before leaving
  const saldos = await calcularSaldosGrupo(grupoId);
  const tieneDeuda = saldos.some(
    (s) => (s.deudorId === usuarioId || s.acreedorId === usuarioId) && s.monto > 0
  );
  if (tieneDeuda) throw new Error('Debes saldar tus deudas antes de salir del grupo');

  await prisma.$transaction(async (tx) => {
    // A group must never be left without an administrator: hand the role to the longest-standing member.
    if (miembro.rol === 'admin') {
      const otrosAdmins = await tx.grupoMiembro.count({
        where: { grupoId, activo: true, rol: 'admin', usuarioId: { not: usuarioId } },
      });
      if (otrosAdmins === 0) {
        const sucesor = await tx.grupoMiembro.findFirst({
          where: { grupoId, activo: true, usuarioId: { not: usuarioId } },
          orderBy: { fechaUnion: 'asc' },
        });
        if (sucesor) await tx.grupoMiembro.update({ where: { id: sucesor.id }, data: { rol: 'admin' } });
      }
    }
    await tx.grupoMiembro.update({
      where: { id: miembro.id },
      data: { activo: false },
    });
  });
}
