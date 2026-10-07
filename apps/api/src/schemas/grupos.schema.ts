import { z } from 'zod';

export const crearGrupoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  descripcion: z.string().trim().max(500).optional(),
  tipo: z.enum(['viaje', 'roomies', 'pareja', 'amigos', 'trabajo', 'deporte', 'otro']).default('amigos'),
});

// Metadata only: never accept participants, balances, ownership or invite codes.
export const editarGrupoSchema = crearGrupoSchema.partial().strict().refine(
  (input) => Object.keys(input).length > 0,
  'Indica qué dato del grupo quieres cambiar',
);

export const invitarSchema = z.object({
  celular: z
    .string()
    .regex(/^9\d{8}$/, 'El celular debe ser formato peruano: 9XXXXXXXX')
    .optional(),
});

export type CrearGrupoInput = z.infer<typeof crearGrupoSchema>;
export type EditarGrupoInput = z.infer<typeof editarGrupoSchema>;
export type InvitarInput = z.infer<typeof invitarSchema>;
