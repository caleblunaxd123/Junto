-- Idempotency key for expense creation: a double tap or retry returns the same expense.
-- Additive and nullable: existing rows are untouched.
ALTER TABLE "gastos" ADD COLUMN     "solicitud_id" VARCHAR(80);

CREATE UNIQUE INDEX "gastos_creado_por_solicitud_id_key" ON "gastos"("creado_por", "solicitud_id");
