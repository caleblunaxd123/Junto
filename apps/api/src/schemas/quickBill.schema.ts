import { z } from "zod";

const person = z.object({
  id: z.string().regex(/^[A-Za-z0-9_-]{1,80}$/),
  nombre: z.string().trim().min(1, "Escribe el nombre de cada persona.").max(100),
  consumo: z.number().int().nonnegative().max(999_999_999),
  invitado: z.boolean(),
}).strict();
// Read compatibility for saved accounts predating receipt-total reconciliation.
export const quickBillReadSchema = z.object({
  nombre: z.string().trim().min(2, "El nombre de la cuenta necesita al menos 2 caracteres.").max(100),
  participantes: z.array(person).min(1).max(50),
  extras: z.number().int().nonnegative().max(999_999_999),
  cobrarA: z.string().trim().max(100), instrucciones: z.string().trim().max(500),
  division: z.enum(["consumos", "igual"]).optional(),
  totalCuenta: z.number().int().positive().max(999_999_999).optional(),
}).strict();
// Never infer a new receipt total from the numbers we are meant to validate.
export const quickBillWriteSchema = quickBillReadSchema.extend({
  totalCuenta: z.number({ required_error: "Indica el total de la cuenta del primer paso." }).int().positive("El total debe ser mayor que cero.").max(999_999_999),
});
