import { z } from 'zod';

const participanteSchema = z.object({
  usuarioId: z.string().uuid(),
  monto: z.number().int().positive().optional(), // en centavos, opcional si es igualitario
  porcentaje: z.number().min(0).max(100).optional(),
});

export const crearGastoSchema = z.object({
  descripcion: z.string().min(1).max(200),
  montoTotal: z.number().int().positive(), // en centavos
  pagadoPor: z.string().uuid(),
  categoria: z
    .enum(['comida', 'transporte', 'entretenimiento', 'alojamiento', 'compras', 'otro'])
    .default('otro'),
  tipoDivision: z.enum(['igual', 'exacto', 'porcentaje']).default('igual'),
  participantes: z.array(participanteSchema).min(1),
  notas: z.string().max(500).optional(),
  fecha: z.string().datetime().optional(),
});

export const editarGastoSchema = crearGastoSchema.partial();

export type CrearGastoInput = z.infer<typeof crearGastoSchema>;
export type EditarGastoInput = z.infer<typeof editarGastoSchema>;
