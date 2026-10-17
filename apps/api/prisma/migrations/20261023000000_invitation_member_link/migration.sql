-- Additive: link an invitation to the name-only member added from contacts, and link expense notices to their expense.
ALTER TABLE "invitaciones" ADD COLUMN "integrante_id" UUID REFERENCES "usuarios"("id") ON DELETE SET NULL;
ALTER TABLE "avisos_grupo" ADD COLUMN "gasto_id" UUID REFERENCES "gastos"("id") ON DELETE CASCADE;
CREATE UNIQUE INDEX "avisos_grupo_gasto_id_usuario_id_tipo_key" ON "avisos_grupo"("gasto_id", "usuario_id", "tipo");
