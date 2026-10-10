CREATE TABLE "avisos_grupo" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grupo_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "integrante_id" UUID NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "leido" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "avisos_grupo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "avisos_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "avisos_grupo_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "avisos_grupo_integrante_id_fkey" FOREIGN KEY ("integrante_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "avisos_grupo_usuario_id_leido_fecha_idx" ON "avisos_grupo"("usuario_id", "leido", "fecha");
