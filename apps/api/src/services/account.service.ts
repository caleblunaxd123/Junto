import bcrypt from "bcryptjs";
import crypto from "crypto";
import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { resumenCuentasGrupo } from "./balance.service";
import { hasPassword } from "./auth.service";

/** What the person should know before deleting: open balances stay recorded for the others. */
export async function deletionSummary(userId: string) {
  const memberships = await prisma.grupoMiembro.findMany({
    where: { usuarioId: userId, activo: true, grupo: { activo: true } },
    include: { grupo: { select: { id: true, nombre: true } } },
  });
  let debes = 0;
  let teDeben = 0;
  const gruposConSaldo: { id: string; nombre: string }[] = [];
  for (const { grupo } of memberships) {
    const { saldos } = await resumenCuentasGrupo(grupo.id);
    const owes = saldos.filter((s) => s.deudorId === userId).reduce((sum, s) => sum + s.monto, 0);
    const owed = saldos.filter((s) => s.acreedorId === userId).reduce((sum, s) => sum + s.monto, 0);
    debes += owes;
    teDeben += owed;
    if (owes || owed) gruposConSaldo.push(grupo);
  }
  const pagosPorConfirmar = await prisma.pago.count({ where: { receptorId: userId, estado: "reportado" } });
  const cuentasPuntuales = await prisma.cuentaRapida.count({ where: { creadoPor: userId } });
  const { passwordHash } = await prisma.usuario.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  return { grupos: memberships.length, gruposConSaldo, debes, teDeben, pagosPorConfirmar, cuentasPuntuales, tienePassword: hasPassword(passwordHash) };
}

/**
 * Deletes the account by anonymizing it. Expenses and payments shared with other people are kept
 * (under "Usuario eliminado") so nobody else's balance changes; personal data is erased.
 */
export async function deleteAccount(userId: string, confirmation: { password?: string; confirmacion?: string }) {
  const usuario = await prisma.usuario.findUnique({ where: { id: userId } });
  if (!usuario || !usuario.activo) throw new UserError("Esta cuenta ya no está activa.", 404);
  if (hasPassword(usuario.passwordHash)) {
    if (!confirmation.password || !(await bcrypt.compare(confirmation.password, usuario.passwordHash)))
      throw new UserError("La contraseña no coincide. Escríbela de nuevo.", 400, "PASSWORD_INCORRECTA");
  } else if (confirmation.confirmacion?.trim().toUpperCase() !== "ELIMINAR") {
    // Google-only accounts have no password: an explicit typed confirmation stands in for it.
    throw new UserError("Escribe ELIMINAR para confirmar.", 400, "CONFIRMACION_REQUERIDA");
  }

  await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM usuarios WHERE id = ${userId}::uuid FOR UPDATE`;
    const memberships = await tx.grupoMiembro.findMany({ where: { usuarioId: userId, activo: true } });
    for (const membership of memberships) {
      const others = await tx.grupoMiembro.findMany({
        where: { grupoId: membership.grupoId, activo: true, usuarioId: { not: userId } },
        orderBy: { fechaUnion: "asc" },
      });
      if (!others.length) {
        // Nobody else can see this group any more.
        await tx.grupo.update({ where: { id: membership.grupoId }, data: { activo: false, linkInvitacion: null } });
      } else if (membership.rol === "admin" && !others.some((other) => other.rol === "admin")) {
        await tx.grupoMiembro.update({ where: { id: others[0].id }, data: { rol: "admin" } });
      }
    }
    await tx.grupoMiembro.updateMany({ where: { usuarioId: userId }, data: { activo: false } });
    // Nobody can confirm a payment addressed to a deleted account; the debt stays visible to the payer.
    await tx.pago.updateMany({
      where: { receptorId: userId, estado: "reportado" },
      data: { estado: "cancelado", fechaResolucion: new Date() },
    });
    await tx.cuentaRapida.deleteMany({ where: { creadoPor: userId } });
    // Voucher images show the person's name and number: erased. Read amounts stay as the record.
    await tx.comprobante.deleteMany({ where: { subidoPor: userId, pagoId: null } });
    await tx.comprobanteImagen.deleteMany({ where: { comprobante: { subidoPor: userId } } });
    await tx.comprobante.updateMany({ where: { subidoPor: userId }, data: { destinatarioLeido: null, codigoSeguridad: null } });
    await tx.comentario.updateMany({ where: { autorId: userId }, data: { eliminado: true, texto: "" } });
    await tx.reporteComentario.deleteMany({ where: { usuarioId: userId } });
    await tx.invitacion.deleteMany({ where: { OR: [{ invitadoId: userId }, { invitadoPor: userId }] } });
    await tx.correoCompartido.deleteMany({ where: { usuarioId: userId } });
    await tx.recordatorio.deleteMany({ where: { OR: [{ enviadoPor: userId }, { enviadoA: userId }] } });
    await tx.configRecordatorio.deleteMany({ where: { configuradoPor: userId } });
    await tx.refreshToken.deleteMany({ where: { usuarioId: userId } });
    await tx.usuario.update({
      where: { id: userId },
      data: {
        nombre: "Usuario eliminado",
        email: `eliminado-${userId}@junto.invalid`,
        celular: null,
        fotoUrl: null,
        expoPushToken: null,
        googleId: null,
        passwordHash: `!eliminado:${crypto.randomBytes(24).toString("hex")}`,
        otpCode: null,
        otpExpires: null,
        otpPurpose: null,
        otpAttempts: 0,
        emailVerificado: false,
        activo: false,
        fechaEliminacion: new Date(),
      },
    });
  });
}
