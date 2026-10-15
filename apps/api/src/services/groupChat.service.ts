import { prisma } from "../lib/prisma";
import { UserError } from "../domain/errors";
import { isOnline } from "../domain/presence";
import { deliveryState, reactionSummary } from "../domain/chatState";
import { partsSummary } from "../domain/billParts";
import { paymentPermissions } from "./pagos.service";

const person = { select: { id: true, nombre: true, fotoUrl: true } } as const;
const LIMIT = 150;

/**
 * The group as a conversation about money, oldest first: the bill, who joined (and the part they
 * took), each payment with its confirmation state, reminders, and plain messages.
 */
export async function getGroupChat(userId: string, grupoId: string) {
  // Never mark an event arriving during these queries as already read.
  const readThrough = new Date();
  const viewer = await prisma.grupoMiembro.findFirst({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } }, select: { rol: true, grupo: { select: { aprobacionPagos: true, creadoPor: true, fechaCreacion: true, creador: person, mensajeFijadoId: true } } } });
  if (!viewer) throw new UserError("No perteneces a este grupo", 403);
  const approves = viewer.rol === "admin" && viewer.grupo.aprobacionPagos === "administrador";
  const [members, notices, expenses, payments, reminders, messages, events] = await Promise.all([
    prisma.grupoMiembro.findMany({ where: { grupoId }, include: { usuario: { select: { id: true, nombre: true, fotoUrl: true, sinCuenta: true, ultimaConexion: true } } }, orderBy: { fechaUnion: "desc" }, take: LIMIT }),
    prisma.avisoGrupo.findMany({ where: { grupoId, parte: { not: null } }, select: { integranteId: true, parte: true }, orderBy: { fecha: "desc" }, distinct: ["integranteId"] }),
    prisma.gasto.findMany({ where: { grupoId, activo: true }, include: { creador: person, pagador: person, participantes: { select: { usuarioId: true, montoAsignado: true } }, _count: { select: { comentarios: { where: { eliminado: false } } } } }, orderBy: { fechaRegistro: "desc" }, take: LIMIT }),
    prisma.pago.findMany({ where: { grupoId }, include: { pagador: person, receptor: { select: { id: true, nombre: true, fotoUrl: true, sinCuenta: true } }, resolutor: person, comprobante: { select: { id: true } }, _count: { select: { comentarios: { where: { eliminado: false } } } } }, orderBy: { fechaPago: "desc" }, take: LIMIT }),
    // A reminder is between who owes and who collects: the rest of the group never sees it.
    prisma.recordatorio.findMany({ where: { grupoId, OR: [{ enviadoPor: userId }, { enviadoA: userId }] }, include: { enviador: person, receptor: person }, orderBy: { fechaEnvio: "desc" }, take: LIMIT }),
    prisma.comentario.findMany({ where: { grupoId, gastoId: null, pagoId: null }, include: { autor: person, reacciones: { select: { usuarioId: true, emoji: true } }, respondeA: { select: { id: true, texto: true, eliminado: true, autor: person } } }, orderBy: { fechaCreacion: "desc" }, take: LIMIT }),
    prisma.eventoGrupo.findMany({ where: { grupoId }, include: { autor: person }, orderBy: [{ fecha: 'desc' }, { id: 'desc' }], take: LIMIT }),
  ]);
  const parts = new Map(notices.map((n) => [n.integranteId, n.parte!]));
  // Opening the chat reads it, like WhatsApp.
  await prisma.grupoMiembro.updateMany({ where: { grupoId, usuarioId: userId, activo: true, OR: [{ ultimaLectura: null }, { ultimaLectura: { lt: readThrough } }] }, data: { ultimaLectura: readThrough } });
  const mine = (id: string) => id === userId;
  // Who could have received/seen what I post: active members with an account, other than me.
  const audience = members.filter((m) => m.activo && !m.usuario.sinCuenta && m.usuarioId !== userId)
    .map((m) => ({ fechaUnion: m.fechaUnion, ultimaLectura: m.ultimaLectura, ultimaConexion: m.usuario.ultimaConexion }));
  const ticks = (own: boolean, fecha: Date) => (own ? { entrega: deliveryState(fecha, audience) } : {});
  const items = [
    { id: `grupo-${grupoId}`, tipo: "creado" as const, fecha: viewer.grupo.fechaCreacion, autor: viewer.grupo.creador, mio: mine(viewer.grupo.creadoPor) },
    ...events.map(e => ({ id: `evento-${e.id}`, tipo: 'cambio' as const, fecha: e.fecha, autor: e.autor, mio: mine(e.autorId), texto: e.texto, evento: e.tipo })),
    ...members.filter((m) => m.usuarioId !== viewer.grupo.creadoPor || m.fechaUnion.getTime() - viewer.grupo.fechaCreacion.getTime() > 60_000).map((m) => ({
      id: `union-${m.id}`, tipo: "union" as const, fecha: m.fechaUnion, autor: m.usuario, mio: mine(m.usuarioId), parte: parts.get(m.usuarioId) ?? null, activo: m.activo,
      // Added by name (no account): "Se agregó a Ana", not "Ana se unió".
      sinCuenta: m.usuario.sinCuenta,
    })),
    ...expenses.map((e) => ({
      id: `gasto-${e.id}`, tipo: e.partes ? "cuenta" as const : "gasto" as const, fecha: e.fechaRegistro, autor: e.creador, mio: mine(e.creadoPor), ...ticks(mine(e.creadoPor), e.fechaRegistro),
      gastoId: e.id, descripcion: e.descripcion, monto: e.montoTotal, pagador: e.pagador, comentarios: e._count.comentarios,
      tuParte: e.participantes.find((p) => p.usuarioId === userId)?.montoAsignado ?? null,
      ...(e.partes ? partsSummary(e.montoTotal, e.partes, e.pagadoPor, e.participantes) : {}),
    })),
    ...payments.map((p) => ({
      id: `pago-${p.id}`, tipo: "pago" as const, fecha: p.fechaPago, autor: p.pagador, mio: mine(p.pagadorId),
      pagoId: p.id, monto: p.monto, monedaOrigen: p.monedaOrigen, montoOrigen: p.montoOrigen, tipoCambio: p.tipoCambio, metodo: p.metodo, estado: p.estado, receptor: p.receptor, resolutor: p.resolutor, fechaResolucion: p.fechaResolucion, comentarios: p._count.comentarios,
      tieneComprobante: !!p.comprobante,
      puedeVerComprobante: !!p.comprobante && paymentPermissions({ ...p, grupo: { aprobacionPagos: viewer.grupo.aprobacionPagos } }, userId, viewer.rol === "admin").verComprobante,
      // As who the viewer decides a waiting payment; null when it is not theirs to decide.
      apruebaComo: p.estado !== "reportado" || mine(p.pagadorId) ? null : mine(p.receptorId) ? "receptor" : approves || (viewer.rol === "admin" && p.receptor.sinCuenta) ? "administrador" : null,
    })),
    ...reminders.map((r) => ({ id: `recordatorio-${r.id}`, tipo: "recordatorio" as const, fecha: r.fechaEnvio, autor: r.enviador, mio: mine(r.enviadoPor), para: r.receptor, monto: r.monto, aviso: r.tipo === "manual" ? null : r.tipo })),
    ...messages.map((c) => ({ id: `mensaje-${c.id}`, tipo: "mensaje" as const, fecha: c.fechaCreacion, autor: c.autor, mio: mine(c.autorId), ...ticks(mine(c.autorId) && !c.eliminado, c.fechaCreacion), comentarioId: c.id, texto: c.eliminado ? "" : c.texto, eliminado: c.eliminado, puedeEliminar: !c.eliminado && (mine(c.autorId) || viewer.rol === "admin"),
      reacciones: c.eliminado ? [] : reactionSummary(c.reacciones, userId), fijado: viewer.grupo.mensajeFijadoId === c.id,
      ...(c.respondeA && !c.eliminado ? { respuesta: { comentarioId: c.respondeA.id, autor: c.respondeA.autor, eliminado: c.respondeA.eliminado, texto: c.respondeA.eliminado ? "" : c.respondeA.texto.length > 140 ? `${c.respondeA.texto.slice(0, 137)}…` : c.respondeA.texto } } : {}) })),
  ];
  return items.sort((a, b) => a.fecha.getTime() - b.fecha.getTime()).slice(-200);
}

/** What happened in the group since the member last opened its chat, not counting their own actions. */
export async function unreadInGroup(grupoId: string, userId: string, since: Date) {
  const after = { gt: since };
  const [messages, payments, expenses, joins, events] = await Promise.all([
    prisma.comentario.count({ where: { grupoId, gastoId: null, pagoId: null, eliminado: false, autorId: { not: userId }, fechaCreacion: after } }),
    prisma.pago.count({ where: { grupoId, OR: [
      { pagadorId: { not: userId }, fechaPago: after },
      { resueltoPor: { not: userId }, fechaResolucion: after },
    ] } }),
    prisma.gasto.count({ where: { grupoId, activo: true, creadoPor: { not: userId }, fechaRegistro: after } }),
    prisma.grupoMiembro.count({ where: { grupoId, usuarioId: { not: userId }, fechaUnion: after } }),
    prisma.eventoGrupo.count({ where: { grupoId, autorId: { not: userId }, fecha: after } }),
  ]);
  return messages + payments + expenses + joins + events;
}

/** "En línea" / last seen for the group's members with an account, for members only. */
export async function groupPresence(userId: string, grupoId: string) {
  const viewer = await prisma.grupoMiembro.count({ where: { grupoId, usuarioId: userId, activo: true, grupo: { activo: true } } });
  if (!viewer) throw new UserError("No perteneces a este grupo", 403);
  const members = await prisma.grupoMiembro.findMany({
    where: { grupoId, activo: true, usuario: { activo: true, sinCuenta: false } },
    select: { usuarioId: true, usuario: { select: { ultimaConexion: true } } },
  });
  const now = new Date();
  return members.map((m) => ({ usuarioId: m.usuarioId, enLinea: isOnline(m.usuario.ultimaConexion, now), ultimaConexion: m.usuario.ultimaConexion }));
}
