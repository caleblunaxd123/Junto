import { z } from 'zod';

export const iniciarPagoSchema = z.object({
  deudorId: z.string().uuid(),
  acreedorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999), // en centavos
  metodo: z.enum(['yape', 'plin', 'tarjeta']),
});

export const procesarPagoSchema = z.object({
  tokenId: z.string().min(1),
  deudorId: z.string().uuid(),
  acreedorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999), // en centavos
  metodo: z.enum(['yape', 'plin', 'tarjeta']),
  email: z.string().email(),
});

export type IniciarPagoInput = z.infer<typeof iniciarPagoSchema>;
export type ProcesarPagoInput = z.infer<typeof procesarPagoSchema>;

export const reportarPagoSchema = z.object({
  nota: z.string().trim().max(100).optional(),
  receptorId: z.string().uuid(),
  grupoId: z.string().uuid(),
  monto: z.number().int().positive().max(999_999_999),
  metodo: z.enum(['yape', 'plin', 'transferencia', 'efectivo']),
});

export type ReportarPagoInput = z.infer<typeof reportarPagoSchema>;
