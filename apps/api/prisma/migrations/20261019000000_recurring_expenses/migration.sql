-- AlterTable
ALTER TABLE "gastos" ADD COLUMN     "recurrente_id" UUID;

-- CreateTable
CREATE TABLE "gastos_recurrentes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "creado_por" UUID NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "categoria" VARCHAR(30) NOT NULL DEFAULT 'otro',
    "monto_total" INTEGER NOT NULL,
    "pagado_por" UUID NOT NULL,
    "tipo_division" VARCHAR(20) NOT NULL,
    "participantes" JSONB NOT NULL,
    "notas" VARCHAR(500),
    "frecuencia" VARCHAR(12) NOT NULL,
    "dia_mes" INTEGER,
    "proxima_fecha" DATE NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "pausa_motivo" VARCHAR(200),
    "solicitud_id" VARCHAR(80),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gastos_recurrentes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "gastos_recurrentes_activo_proxima_fecha_idx" ON "gastos_recurrentes"("activo", "proxima_fecha");

-- CreateIndex
CREATE INDEX "gastos_recurrentes_grupo_id_idx" ON "gastos_recurrentes"("grupo_id");

-- CreateIndex
CREATE UNIQUE INDEX "gastos_recurrentes_creado_por_solicitud_id_key" ON "gastos_recurrentes"("creado_por", "solicitud_id");

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_recurrente_id_fkey" FOREIGN KEY ("recurrente_id") REFERENCES "gastos_recurrentes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos_recurrentes" ADD CONSTRAINT "gastos_recurrentes_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

