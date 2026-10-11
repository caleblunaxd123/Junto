CREATE TABLE "cotizaciones_cambio" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(), "clave" VARCHAR(64) NOT NULL,
  "origen" CHAR(3) NOT NULL, "destino" CHAR(3) NOT NULL, "fecha" DATE NOT NULL,
  "tasa" VARCHAR(20) NOT NULL, "fuente" VARCHAR(100) NOT NULL, "consultada" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cotizaciones_cambio_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cotizaciones_cambio_clave_key" ON "cotizaciones_cambio"("clave");
ALTER TABLE "pagos" ADD COLUMN "fecha_efectiva" DATE, ADD COLUMN "referencia_cambio_id" UUID;
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_referencia_cambio_id_fkey" FOREIGN KEY ("referencia_cambio_id") REFERENCES "cotizaciones_cambio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "avisos_grupo" ADD COLUMN "tipo" VARCHAR(24) NOT NULL DEFAULT 'integrante_unido', ADD COLUMN "pago_id" UUID;
CREATE UNIQUE INDEX "avisos_grupo_pago_id_usuario_id_tipo_key" ON "avisos_grupo"("pago_id", "usuario_id", "tipo");
ALTER TABLE "avisos_grupo" ADD CONSTRAINT "avisos_grupo_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
