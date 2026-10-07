import { z } from "zod";

const participanteSchema = z.object({
  usuarioId: z.string().uuid(),
  monto: z.number().int().nonnegative().max(999_999_999).optional(), // una persona puede tener parte cero
  porcentaje: z.number().min(0).max(100).optional(),
}).strict();

export const crearGastoSchema = z.object({
  descripcion: z.string().trim().min(1).max(200),
  montoTotal: z.number().int().positive().max(999_999_999), // mismo límite del formulario, en centavos
  pagadoPor: z.string().uuid(),
  categoria: z
    .enum([
      "comida",
      "transporte",
      "entretenimiento",
      "alojamiento",
      "compras",
      "otro",
    ])
    .default("otro"),
  tipoDivision: z.enum(["igual", "exacto", "porcentaje"]).default("igual"),
  participantes: z.array(participanteSchema).min(1),
  notas: z.string().max(500).optional(),
  fecha: z.string().datetime().optional(),
});

export const editarGastoSchema = crearGastoSchema.partial().strict().refine((input) => Object.keys(input).length > 0, "Indica qué dato del gasto quieres corregir.");

export const paginaGastosSchema = z.coerce.number().int().min(1).max(100_000).default(1);

export type CrearGastoInput = z.infer<typeof crearGastoSchema>;
export type EditarGastoInput = z.infer<typeof editarGastoSchema>;
