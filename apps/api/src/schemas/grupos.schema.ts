import { z } from 'zod';

export const crearGrupoSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  descripcion: z.string().max(500).optional(),
  tipo: z.enum(['viaje', 'roomies', 'amigos', 'trabajo', 'otro']).default('amigos'),
});

export const invitarSchema = z.object({
  celular: z
    .string()
    .regex(/^9\d{8}$/, 'El celular debe ser formato peruano: 9XXXXXXXX')
    .optional(),
});

export type CrearGrupoInput = z.infer<typeof crearGrupoSchema>;
export type InvitarInput = z.infer<typeof invitarSchema>;
