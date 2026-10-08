CREATE TABLE "recibos_push" (
  "ticket_id" VARCHAR(200) NOT NULL,
  "usuario_id" UUID NOT NULL,
  "token" VARCHAR(200) NOT NULL,
  "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultima_consulta" TIMESTAMP(3),
  CONSTRAINT "recibos_push_pkey" PRIMARY KEY ("ticket_id")
);
CREATE INDEX "recibos_push_fecha_creacion_ultima_consulta_idx" ON "recibos_push"("fecha_creacion", "ultima_consulta");
ALTER TABLE "recibos_push" ADD CONSTRAINT "recibos_push_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
