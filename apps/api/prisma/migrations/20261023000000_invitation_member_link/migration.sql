-- Additive: link an invitation to the name-only member added from contacts, and link expense notices to their expense.
ALTER TABLE "invitaciones" ADD COLUMN "integrante_id" UUID;
ALTER TABLE "avisos_grupo" ADD COLUMN "gasto_id" UUID;
CREATE UNIQUE INDEX "avisos_grupo_gasto_id_usuario_id_tipo_key" ON "avisos_grupo"("gasto_id", "usuario_id", "tipo");
-- Same constraint names and rules Prisma derives from schema.prisma, so CI finds no drift.
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_integrante_id_fkey" FOREIGN KEY ("integrante_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "avisos_grupo" ADD CONSTRAINT "avisos_grupo_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
