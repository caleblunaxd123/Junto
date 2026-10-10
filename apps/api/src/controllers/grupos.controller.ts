import { Request, Response, NextFunction } from "express";
import * as gruposService from "../services/grupos.service";
import { calcularSaldosGrupo } from "../services/balance.service";
import { crearGrupoSchema, editarGrupoSchema, invitarSchema } from "../schemas/grupos.schema";
import { z } from "zod";
import { INVITE_SENT, invitePerson } from "../services/invitaciones.service";
import { validShareEmail } from "@junto/shared/share";
import { UserError } from "../domain/errors";

export async function crearGrupo(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const input = crearGrupoSchema.parse(req.body);
    const grupo = await gruposService.crearGrupo(input, req.user!.userId);
    res.status(201).json(grupo);
  } catch (err) {
    next(err);
  }
}

export async function getGrupos(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const grupos = await gruposService.getGruposUsuario(req.user!.userId);
    res.json(grupos);
  } catch (err) {
    next(err);
  }
}

export async function editarGrupo(req: Request, res: Response, next: NextFunction) {
  try {
    const input = editarGrupoSchema.parse(req.body);
    res.json(await gruposService.editarGrupo(req.params.id, input, req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export async function getGrupo(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const grupo = await gruposService.getGrupoDetalle(
      req.params.id,
      req.user!.userId,
    );
    res.json(grupo);
  } catch (err) {
    next(err);
  }
}

export async function getSaldos(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const miembro = await import("../lib/prisma").then(({ prisma }) =>
      prisma.grupoMiembro.findFirst({
        where: {
          grupoId: req.params.id,
          usuarioId: req.user!.userId,
          activo: true,
        },
      }),
    );
    if (!miembro) {
      res.status(403).json({ error: "No perteneces a este grupo" });
      return;
    }
    const saldos = await calcularSaldosGrupo(req.params.id);
    res.json(saldos);
  } catch (err) {
    next(err);
  }
}

export async function invitar(req: Request, res: Response, next: NextFunction) {
  try {
    const group = await gruposService.getGrupoDetalle(req.params.id, req.user!.userId);
    const { identificador, celular } = z
      .object({ identificador: z.string().trim().min(2).max(255).optional(), celular: invitarSchema.shape.celular })
      .parse(req.body ?? {});
    const target = identificador ?? celular;
    if (target) {
      if (!validShareEmail(target) && !/^(?:\+?51)?9\d{8}$/.test(target.replace(/\s/g, "")))
        throw new UserError("Escribe un correo válido o un celular peruano de 9 dígitos que empiece con 9.", 400);
      // Invited people must accept: nobody is added to a group (or shown to it) without consent.
      const result = await invitePerson(req.params.id, req.user!.userId, target);
      res.json({ ...result, invitacionEnviada: !result.alreadyMember, linkCode: group.linkInvitacion });
      return;
    }
    res.json({
      link: `${process.env.FRONTEND_URL}/unirse/${group.linkInvitacion}`,
      linkCode: group.linkInvitacion,
      nombre: group.nombre,
    });
  } catch (err) {
    next(err);
  }
}

export async function unirse(req: Request, res: Response, next: NextFunction) {
  try {
    const { link } = z.object({ link: z.string() }).parse(req.body);
    const result = await gruposService.unirseConLink(link, req.user!.userId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

/** Only basic context for a signed-in person holding the invitation; never balances. */
export async function invitacion(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const code = z
      .string()
      .regex(/^[A-Za-z0-9_-]{8,128}$/)
      .parse(req.params.code);
    const { prisma } = await import("../lib/prisma");
    const grupo = await prisma.grupo.findFirst({
      where: { linkInvitacion: code, activo: true },
      select: {
        id: true,
        nombre: true,
        tipo: true,
        modo: true,
        _count: { select: { miembros: { where: { activo: true } } } },
      },
    });
    if (!grupo) {
      res
        .status(404)
        .json({
          error: "Esta invitación ya no está disponible. Pide un enlace nuevo.",
        });
      return;
    }
    // What joining means in money: the part this person would take, if one is free.
    const cuenta = await gruposService.cuentaPorPartes(grupo.id);
    res.json({
      nombre: grupo.nombre,
      tipo: grupo.tipo,
      modo: grupo.modo,
      miembros: grupo._count.miembros,
      // Only the first name of whoever paid: enough to know who to pay back, nothing more.
      cuenta: cuenta && { descripcion: cuenta.descripcion, montoTotal: cuenta.montoTotal, partes: cuenta.partes, parte: cuenta.parte, libres: cuenta.libres, pagadorNombre: cuenta.pagadorNombre.trim().split(/\s+/)[0] },
    });
  } catch (error) {
    next(error);
  }
}

export async function salir(req: Request, res: Response, next: NextFunction) {
  try {
    await gruposService.salirDeGrupo(req.params.id, req.user!.userId);
    res.json({ message: "Saliste del grupo correctamente" });
  } catch (err) {
    next(err);
  }
}

export async function agregarMiembrosBulk(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { celulares } = z
      .object({ celulares: z.array(z.string().max(20)).min(1).max(30) })
      .parse(req.body);
    await gruposService.getGrupoDetalle(req.params.id, req.user!.userId);
    for (const celular of celulares) await invitePerson(req.params.id, req.user!.userId, celular);
    // Counts and identities stay private: each person decides whether to join.
    res.json({ mensaje: INVITE_SENT });
  } catch (err) {
    next(err);
  }
}
