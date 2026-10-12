-- Replies in the group chat (additive).
ALTER TABLE "comentarios" ADD COLUMN "responde_a_id" UUID;

ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_responde_a_id_fkey" FOREIGN KEY ("responde_a_id") REFERENCES "comentarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
