import { z } from 'zod';

// Payments happen outside JUNTO (Yape, Plin, transfer or cash); the receiver confirms them.
export const reportarPagoSchema = z.object({
  nota: z.string().trim().max(100).optional(),
  receptorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999),
  metodo: z.enum(['yape', 'plin', 'transferencia', 'efectivo']),
  // A voucher uploaded first (see POST /pagos/comprobantes); optional, cash has none.
  comprobanteId: z.string().uuid().optional(),
});

// ~3 MB image in base64.
export const subirComprobanteSchema = z.object({
  grupoId: z.string().uuid(),
  imagen: z.string().min(16).max(4_200_000),
}).strict();

export type ReportarPagoInput = z.infer<typeof reportarPagoSchema>;
