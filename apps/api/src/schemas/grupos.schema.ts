import { z } from 'zod';

const grupoSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').max(100),
  descripcion: z.string().trim().max(500).optional(),
  tipo: z.enum(['viaje', 'roomies', 'pareja', 'amigos', 'trabajo', 'deporte', 'otro']).default('amigos'),
  // "administrador": who receives a payment or a group admin may approve it (never the payer).
  aprobacionPagos: z.enum(['receptor', 'administrador']).optional(),
  modo: z.enum(['cobranza', 'division']).optional(),
  // null removes it. A deadline already in the past would only send "venció" reminders.
  fechaLimite: z.string().datetime({ offset: true }).nullable().optional()
    .refine((value) => !value || new Date(value).getTime() > Date.now() - 60_000, 'La fecha límite debe ser futura')
    .refine((value) => !value || new Date(value).getTime() < Date.now() + 366 * 86_400_000, 'La fecha límite debe estar dentro del próximo año'),
});

export const crearGrupoSchema = grupoSchema.extend({
  // The bill the creator already paid (or will collect for), split in equal parts. Optional.
  cuenta: z.object({
    descripcion: z.string().trim().min(1).max(200).optional(),
    montoTotal: z.number().int().positive('El total debe ser mayor que cero').max(999_999_999),
    partes: z.number().int().min(2, 'Divide la cuenta entre al menos 2 personas').max(100, 'Divide la cuenta entre máximo 100 personas'),
  }).strict().optional(),
});

// Metadata only: never accept participants, balances, ownership, invite codes or a bill.
export const editarGrupoSchema = grupoSchema.partial().strict().refine(
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
