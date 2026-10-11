-- Applied after members-by-name; preserve old accounts and make draft imports safe to retry.
ALTER TABLE "grupos" ADD COLUMN "solicitud_importacion" VARCHAR(80), ADD COLUMN "importacion_huella" CHAR(64);
ALTER TABLE "cuentas_rapidas" ADD COLUMN "grupo_id" UUID;
CREATE UNIQUE INDEX "grupos_creado_por_solicitud_importacion_key" ON "grupos"("creado_por", "solicitud_importacion");
CREATE UNIQUE INDEX "cuentas_rapidas_grupo_id_key" ON "cuentas_rapidas"("grupo_id");
ALTER TABLE "cuentas_rapidas" ADD CONSTRAINT "cuentas_rapidas_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
