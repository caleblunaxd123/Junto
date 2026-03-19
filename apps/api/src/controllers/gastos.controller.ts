import { Request, Response, NextFunction } from 'express';
import * as gastosService from '../services/gastos.service';
import { crearGastoSchema, editarGastoSchema } from '../schemas/gastos.schema';
import { z } from 'zod';

export async function crearGasto(req: Request, res: Response, next: NextFunction) {
  try {
    const input = crearGastoSchema.parse(req.body);
    const gasto = await gastosService.crearGasto(req.params.grupoId, input, req.user!.userId);
    res.status(201).json(gasto);
  } catch (err) {
    next(err);
  }
}

export async function getGastos(req: Request, res: Response, next: NextFunction) {
  try {
    const page = Number(req.query.page) || 1;
    const result = await gastosService.getGastosGrupo(req.params.grupoId, req.user!.userId, page);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getGasto(req: Request, res: Response, next: NextFunction) {
  try {
    const gasto = await gastosService.getGastoDetalle(req.params.id, req.user!.userId);
    res.json(gasto);
  } catch (err) {
    next(err);
  }
}

export async function editarGasto(req: Request, res: Response, next: NextFunction) {
  try {
    const input = editarGastoSchema.parse(req.body);
    const gasto = await gastosService.editarGasto(req.params.id, input, req.user!.userId);
    res.json(gasto);
  } catch (err) {
    next(err);
  }
}

export async function eliminarGasto(req: Request, res: Response, next: NextFunction) {
  try {
    await gastosService.eliminarGasto(req.params.id, req.user!.userId);
    res.json({ message: 'Gasto eliminado' });
  } catch (err) {
    next(err);
  }
}

export async function subirFoto(req: Request, res: Response, next: NextFunction) {
  try {
    // Photo upload handled via URL for MVP (Cloudinary/Supabase direct upload from mobile)
    const { fotoUrl } = z.object({ fotoUrl: z.string().url() }).parse(req.body);
    const { prisma } = await import('../lib/prisma');
    await prisma.gasto.update({ where: { id: req.params.id }, data: { fotoUrl } });
    res.json({ fotoUrl });
  } catch (err) {
    next(err);
  }
}
