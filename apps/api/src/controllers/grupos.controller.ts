import { Request, Response, NextFunction } from "express";
import * as gruposService from "../services/grupos.service";
import { calcularSaldosGrupo } from "../services/balance.service";
import { crearGrupoSchema, editarGrupoSchema, invitarSchema } from "../schemas/grupos.schema";
import { z } from "zod";

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
    if (req.body.identificador) {
      const identifier = z
        .string()
        .trim()
        .min(2)
        .max(255)
        .parse(req.body.identificador);
      const group = await gruposService.getGrupoDetalle(
        req.params.id,
        req.user!.userId,
      );
      const { prisma } = await import("../lib/prisma");
      const usuario = await prisma.usuario.findFirst({
        where: {
          activo: true,
          OR: [
            { email: identifier.toLowerCase() },
            { celular: identifier.replace(/^\+51\s*/, "") },
          ],
        },
      });
      if (!usuario) {
        res.json({
          found: false,
          mensaje:
            "Esta persona aún no tiene cuenta. Comparte el enlace para que se registre y se una.",
          linkCode: group.linkInvitacion,
        });
        return;
      }
      const existing = await prisma.grupoMiembro.findUnique({
        where: {
          grupoId_usuarioId: { grupoId: req.params.id, usuarioId: usuario.id },
        },
      });
      await prisma.grupoMiembro.upsert({
        where: {
          grupoId_usuarioId: { grupoId: req.params.id, usuarioId: usuario.id },
        },
        create: { grupoId: req.params.id, usuarioId: usuario.id },
        update: { activo: true },
      });
      res.json({
        found: true,
        alreadyMember: !!existing?.activo,
        usuario: { id: usuario.id, nombre: usuario.nombre },
      });
      return;
    }
    const { celular } = invitarSchema.parse(req.body);

    if (celular) {
      const result = await gruposService.invitarPorCelular(
        req.params.id,
        celular,
        req.user!.userId,
      );
      res.json(result);
    } else {
      await gruposService.getGrupoDetalle(req.params.id, req.user!.userId);
      // Return the invitation link
      const { prisma } = await import("../lib/prisma");
      const grupo = await prisma.grupo.findUnique({
        where: { id: req.params.id },
        select: { linkInvitacion: true },
      });
      res.json({
        link: `${process.env.FRONTEND_URL}/unirse/${grupo?.linkInvitacion}`,
        linkCode: grupo?.linkInvitacion,
      });
    }
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
        nombre: true,
        tipo: true,
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
    res.json({
      nombre: grupo.nombre,
      tipo: grupo.tipo,
      miembros: grupo._count.miembros,
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
    const { z } = await import("zod");
    const { celulares } = z
      .object({ celulares: z.array(z.string()) })
      .parse(req.body);
    const results = await Promise.all(
      celulares.map((cel: string) =>
        gruposService.invitarPorCelular(
          req.params.id,
          cel.replace("+51", ""),
          req.user!.userId,
        ),
      ),
    );
    const agregados = results.filter((r) => r.found && !r.alreadyMember).length;
    res.json({ agregados, resultados: results });
  } catch (err) {
    next(err);
  }
}
