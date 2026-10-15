ALTER TABLE "grupos"
  ADD COLUMN "estado" VARCHAR(20) NOT NULL DEFAULT 'abierto',
  ADD COLUMN "cierre_solicitado_en" TIMESTAMP(3),
  ADD COLUMN "cerrado_en" TIMESTAMP(3),
  ADD CONSTRAINT "grupos_estado_check" CHECK ("estado" IN ('abierto', 'por_liquidar', 'cerrado'));
ALTER TABLE "grupo_miembros" ADD COLUMN "archivado_en" TIMESTAMP(3);
CREATE TABLE "eventos_grupo" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "grupo_id" UUID NOT NULL,
  "autor_id" UUID NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "texto" TEXT NOT NULL,
  "detalle" JSONB NOT NULL DEFAULT '{}',
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "eventos_grupo_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "eventos_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "eventos_grupo_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "eventos_grupo_grupo_id_fecha_id_idx" ON "eventos_grupo"("grupo_id", "fecha", "id");
