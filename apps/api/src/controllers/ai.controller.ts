import type { NextFunction, Request, Response } from 'express';
import { interpretarGastoSchema } from '../schemas/ai.schema';
import { AiServiceError, interpretarGasto } from '../services/ai.service';

export async function interpretarGastoController(req: Request, res: Response, next: NextFunction) {
  try {
    const input = interpretarGastoSchema.parse(req.body);
    res.json(await interpretarGasto(input, req.user!.userId));
  } catch (error) {
    if (error instanceof AiServiceError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    next(error);
  }
}
