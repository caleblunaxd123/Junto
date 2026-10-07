import { z } from 'zod';

export const interpretarGastoSchema = z.object({
  grupoId: z.string().uuid(),
  texto: z.string().trim().min(3).max(1000),
});

export type InterpretarGastoInput = z.infer<typeof interpretarGastoSchema>;
