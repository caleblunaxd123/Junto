-- Additive: legacy single-payer expenses remain unchanged.
CREATE TABLE "gasto_aportes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gasto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "monto" INTEGER NOT NULL CHECK ("monto" > 0 AND "monto" <= 999999999),
    CONSTRAINT "gasto_aportes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gasto_aportes_gasto_id_usuario_id_key" ON "gasto_aportes"("gasto_id", "usuario_id");
CREATE INDEX "gasto_aportes_usuario_id_idx" ON "gasto_aportes"("usuario_id");
ALTER TABLE "gasto_aportes" ADD CONSTRAINT "gasto_aportes_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gasto_aportes" ADD CONSTRAINT "gasto_aportes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
