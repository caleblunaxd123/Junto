-- Group chat like WhatsApp: one reaction per person per message, and one pinned message per group.
-- Additive: no existing row changes.
CREATE TABLE "reacciones_comentarios" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "comentario_id" UUID NOT NULL,
  "usuario_id" UUID NOT NULL,
  "emoji" VARCHAR(16) NOT NULL,
  "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reacciones_comentarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reacciones_comentarios_comentario_id_fkey" FOREIGN KEY ("comentario_id") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "reacciones_comentarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "reacciones_comentarios_comentario_id_usuario_id_key" ON "reacciones_comentarios"("comentario_id", "usuario_id");

ALTER TABLE "grupos" ADD COLUMN "mensaje_fijado_id" UUID;
ALTER TABLE "grupos" ADD COLUMN "fijado_por" UUID;
