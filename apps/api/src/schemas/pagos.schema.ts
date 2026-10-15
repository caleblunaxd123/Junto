import { z } from 'zod';
import { validPaymentDate } from '../domain/exchange';
const paymentDateSchema = z.string().refine((date) => validPaymentDate(date), 'Elige una fecha válida que no sea futura.');
const conversionSchema = z.object({
  monedaOrigen: z.enum(['PEN', 'COP', 'USD', 'EUR', 'MXN', 'BRL']),
  montoOrigen: z.number().int().positive().max(999_999_999),
  tipoCambio: z.string().trim().max(20),
  cotizacionId: z.string().uuid().optional(),
}).strict();

// Payments happen outside JUNTO (Yape, Plin, transfer or cash); the receiver confirms them.
export const reportarPagoSchema = z.object({
  conversion: conversionSchema.optional(),
  fechaEfectiva: paymentDateSchema.optional(),
  nota: z.string().trim().max(100).optional(),
  receptorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999),
  metodo: z.enum(['yape', 'plin', 'transferencia', 'efectivo']),
  // A voucher uploaded first (see POST /pagos/comprobantes); optional, cash has none.
  comprobanteId: z.string().uuid().optional(),
});

// The receiver records money they already got (cash, or from someone added by name).
export const registrarRecibidoSchema = z.object({
  conversion: conversionSchema.optional(),
  fechaEfectiva: paymentDateSchema.optional(),
  nota: z.string().trim().max(100).optional(),
  // An admin may record receipt for a name-only receiver, never for another real account.
  receptorId: z.string().uuid().optional(),
  pagadorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999),
  metodo: z.enum(['yape', 'plin', 'transferencia', 'efectivo']),
  // A screenshot the receiver uploaded first (POST /pagos/comprobantes); optional, cash has none.
  comprobanteId: z.string().uuid().optional(),
}).strict();

// ~3 MB image in base64.
export const subirComprobanteSchema = z.object({
  grupoId: z.string().uuid(),
  imagen: z.string().min(16).max(4_200_000),
}).strict();

export type ReportarPagoInput = z.infer<typeof reportarPagoSchema>;
export type RegistrarRecibidoInput = z.infer<typeof registrarRecibidoSchema>;
