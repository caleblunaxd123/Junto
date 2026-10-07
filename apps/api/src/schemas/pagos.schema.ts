import { z } from 'zod';

// Payments happen outside JUNTO (Yape, Plin, transfer or cash); the receiver confirms them.
export const reportarPagoSchema = z.object({
  nota: z.string().trim().max(100).optional(),
  receptorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999),
  metodo: z.enum(['yape', 'plin', 'transferencia', 'efectivo']),
});

export type ReportarPagoInput = z.infer<typeof reportarPagoSchema>;
