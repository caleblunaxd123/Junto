import { Request, Response, NextFunction } from 'express';
import * as gruposService from '../services/grupos.service';
import { calcularSaldosGrupo } from '../services/balance.service';
import { crearGrupoSchema, invitarSchema } from '../schemas/grupos.schema';
import { z } from 'zod';

export async function crearGrupo(req: Request, res: Response, next: NextFunction) {
  try {
    const input = crearGrupoSchema.parse(req.body);
    const grupo = await gruposService.crearGrupo(input, req.user!.userId);
    res.status(201).json(grupo);
  } catch (err) {
    next(err);
  }
}

export async function getGrupos(req: Request, res: Response, next: NextFunction) {
  try {
    const grupos = await gruposService.getGruposUsuario(req.user!.userId);
    res.json(grupos);
  } catch (err) {
    next(err);
  }
}

export async function getGrupo(req: Request, res: Response, next: NextFunction) {
  try {
    const grupo = await gruposService.getGrupoDetalle(req.params.id, req.user!.userId);
    res.json(grupo);
  } catch (err) {
    next(err);
  }
}

export async function getSaldos(req: Request, res: Response, next: NextFunction) {
  try {
    const miembro = await import('../lib/prisma').then(({ prisma }) =>
      prisma.grupoMiembro.findFirst({
        where: { grupoId: req.params.id, usuarioId: req.user!.userId, activo: true },
      })
    );
    if (!miembro) {
      res.status(403).json({ error: 'No perteneces a este grupo' });
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
    const { celular } = invitarSchema.parse(req.body);

    if (celular) {
      const result = await gruposService.invitarPorCelular(req.params.id, celular, req.user!.userId);
      res.json(result);
    } else {
      // Return the invitation link
      const { prisma } = await import('../lib/prisma');
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

export async function salir(req: Request, res: Response, next: NextFunction) {
  try {
    await gruposService.salirDeGrupo(req.params.id, req.user!.userId);
    res.json({ message: 'Saliste del grupo correctamente' });
  } catch (err) {
    next(err);
  }
}
