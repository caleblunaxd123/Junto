import { randomBytes, randomUUID } from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { UserError as Error } from "../domain/errors";
import { requireOpenGroup } from './groupLifecycle.service';

/**
 * Members added by name only ("Ana"), so whoever paid can split right away. They are ordinary
 * ledger participants without login, e-mail or push. When the real person joins — with their
 * personal link, or choosing their name if they are not owed money — they take over that place.
 */
export const MAX_SIN_CUENTA = 50;
type Tx = Prisma.TransactionClient;

export function codigoPersonal() {
  return randomBytes(15).toString("base64url");
}

export function nombreIntegrante(value: string) {
  const nombre = value.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " ").trim();
  if (nombre.length < 1 || nombre.length > 60) throw new Error("Escribe un nombre de 1 a 60 letras.");
  return nombre;
}

/** Inside the group's lock. Unusable e-mail and password: this row can never sign in. */
export async function crearSinCuenta(tx: Tx, grupoId: string, nombres: string[], historical = false) {
  const existentes = await tx.grupoMiembro.findMany({ where: { grupoId, activo: true }, select: { usuario: { select: { nombre: true, sinCuenta: true } } } });
  if (existentes.filter((m) => m.usuario.sinCuenta).length + nombres.length > MAX_SIN_CUENTA)
    throw new Error(`Un grupo puede tener hasta ${MAX_SIN_CUENTA} personas agregadas por nombre.`);
  const usados = new Set(existentes.filter((m) => !historical || m.usuario.sinCuenta).map((m) => m.usuario.nombre.toLocaleLowerCase("es")));
  const creados = [];
  for (const nombre of nombres.map((n) => historical ? n.trim().replace(/\s+/g, " ") : nombreIntegrante(n))) {
    const clave = nombre.toLocaleLowerCase("es");
    if (usados.has(clave)) throw new Error(`Ya hay alguien llamado «${nombre}» en el grupo. Usa otro nombre, por ejemplo con su apellido.`, 409);
    usados.add(clave);
    const usuario = await tx.usuario.create({ data: { nombre, email: `sin-cuenta.${randomUUID()}@junto.invalid`, passwordHash: "!", sinCuenta: true } });
    await tx.grupoMiembro.create({ data: { grupoId, usuarioId: usuario.id, rol: "miembro", codigoPersonal: codigoPersonal() } });
    creados.push({ id: usuario.id, nombre });
  }
  return creados;
}

async function lockActiveMember(tx: Tx, grupoId: string, userId: string) {
  await tx.$queryRaw`SELECT id FROM grupos WHERE id = ${grupoId}::uuid FOR UPDATE`;
  const member = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true }, usuario: { activo: true, sinCuenta: false } }, select: { rol: true } });
  if (!member) throw new Error("No perteneces a este grupo", 403);
  await requireOpenGroup(tx, grupoId);
  return member;
}

export async function agregarIntegrantes(grupoId: string, userId: string, nombres: string[]) {
  return prisma.$transaction(async (tx) => {
    await lockActiveMember(tx, grupoId, userId);
    return crearSinCuenta(tx, grupoId, nombres);
  });
}

async function sinCuentaActivo(tx: Tx, grupoId: string, integranteId: string) {
  const member = await tx.grupoMiembro.findFirst({ where: { grupoId, usuarioId: integranteId, activo: true, usuario: { sinCuenta: true, activo: true } }, select: { id: true } });
  if (!member) throw new Error("Esa persona ya no está en el grupo o ya se unió con su cuenta.", 404);
  return member;
}

/** Only someone not involved in any expense or payment yet: nothing in the ledger moves. */
export async function quitarIntegrante(grupoId: string, userId: string, integranteId: string) {
  await prisma.$transaction(async (tx) => {
    await lockActiveMember(tx, grupoId, userId);
    const member = await sinCuentaActivo(tx, grupoId, integranteId);
    const [parte, pagado, pagos] = await Promise.all([
      tx.gastoParticipante.count({ where: { usuarioId: integranteId, gasto: { grupoId, activo: true } } }),
      tx.gasto.count({ where: { grupoId, activo: true, pagadoPor: integranteId } }),
      tx.pago.count({ where: { grupoId, OR: [{ pagadorId: integranteId }, { receptorId: integranteId }] } }),
    ]);
    if (parte || pagado || pagos) throw new Error("Esta persona ya está en gastos o pagos del grupo. Corrige esos gastos antes de quitarla.", 409);
    await tx.grupoMiembro.update({ where: { id: member.id }, data: { activo: false, codigoPersonal: null } });
    await tx.usuario.update({ where: { id: integranteId }, data: { activo: false } });
  });
}

/** Paid an expense or received a payment: taking their place means collecting money. */
export async function tieneDineroPorRecibir(tx: Tx, grupoId: string, integranteId: string) {
  const [pagado, recibido] = await Promise.all([
    tx.gasto.count({ where: { grupoId, activo: true, pagadoPor: integranteId } }),
    tx.pago.count({ where: { grupoId, receptorId: integranteId, estado: { in: ["reportado", "exitoso"] } } }),
  ]);
  return pagado + recibido > 0;
}

/** Name-only members anyone joining with the group link may say they are (they only owe). */
export async function reclamablesSinCodigo(grupoId: string) {
  const miembros = await prisma.grupoMiembro.findMany({ where: { grupoId, activo: true, usuario: { sinCuenta: true, activo: true } }, select: { usuario: { select: { id: true, nombre: true } } }, orderBy: { fechaUnion: "asc" } });
  const result = [];
  for (const { usuario } of miembros) if (!(await tieneDineroPorRecibir(prisma, grupoId, usuario.id))) result.push(usuario);
  return result;
}

/**
 * Under the group's lock: `haciaId` (a real account, already an active member) takes over every
 * ledger row of the name-only member `desdeId`, who then leaves the group. Totals never change.
 */
export async function heredar(tx: Tx, grupoId: string, desdeId: string, haciaId: string) {
  if (desdeId === haciaId) throw new Error("No puedes unirte contigo mismo.");
  const member = await sinCuentaActivo(tx, grupoId, desdeId);
  const between = await tx.pago.count({ where: { grupoId, OR: [{ pagadorId: desdeId, receptorId: haciaId }, { pagadorId: haciaId, receptorId: desdeId }] } });
  if (between) throw new Error("Hay pagos registrados entre estas dos personas: no pueden ser la misma. Revisa los pagos del grupo.", 409);
  const parts = await tx.gastoParticipante.findMany({ where: { usuarioId: desdeId, gasto: { grupoId } } });
  for (const part of parts) {
    const own = await tx.gastoParticipante.findUnique({ where: { gastoId_usuarioId: { gastoId: part.gastoId, usuarioId: haciaId } } });
    if (own) {
      await tx.gastoParticipante.update({ where: { id: own.id }, data: { montoAsignado: { increment: part.montoAsignado } } });
      await tx.gastoParticipante.delete({ where: { id: part.id } });
    } else {
      await tx.gastoParticipante.update({ where: { id: part.id }, data: { usuarioId: haciaId } });
    }
  }
  await tx.gasto.updateMany({ where: { grupoId, pagadoPor: desdeId }, data: { pagadoPor: haciaId } });
  await tx.gasto.updateMany({ where: { grupoId, creadoPor: desdeId }, data: { creadoPor: haciaId } });
  await tx.pago.updateMany({ where: { grupoId, pagadorId: desdeId }, data: { pagadorId: haciaId } });
  await tx.pago.updateMany({ where: { grupoId, receptorId: desdeId }, data: { receptorId: haciaId } });
  await tx.recordatorio.updateMany({ where: { grupoId, enviadoA: desdeId }, data: { enviadoA: haciaId } });
  await tx.recordatorio.updateMany({ where: { grupoId, enviadoPor: desdeId }, data: { enviadoPor: haciaId } });
  await tx.grupoMiembro.update({ where: { id: member.id }, data: { activo: false, codigoPersonal: null } });
  await tx.usuario.update({ where: { id: desdeId }, data: { activo: false } });
}

/** An admin links a name-only member to someone who already joined with their own account. */
export async function unirIntegrante(grupoId: string, adminId: string, desdeId: string, haciaId: string) {
  await prisma.$transaction(async (tx) => {
    const admin = await lockActiveMember(tx, grupoId, adminId);
    if (admin.rol !== "admin") throw new Error("Solo un administrador del grupo puede hacer esto.", 403);
    const target = await tx.grupoMiembro.count({ where: { grupoId, usuarioId: haciaId, activo: true, usuario: { activo: true, sinCuenta: false } } });
    if (!target) throw new Error("Esa persona todavía no se unió al grupo con su cuenta.", 404);
    await heredar(tx, grupoId, desdeId, haciaId);
  });
}
