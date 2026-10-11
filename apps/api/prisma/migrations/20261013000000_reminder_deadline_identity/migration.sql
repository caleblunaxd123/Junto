-- Additive: old API clients ignore this field. Historical reminders cannot reliably
-- reconstruct their original deadline, so keep them null (do not rewrite history).
ALTER TABLE "recordatorios" ADD COLUMN "limite_referencia" TIMESTAMP(3);
CREATE UNIQUE INDEX "recordatorios_etapa_limite_key"
ON "recordatorios"("grupo_id", "enviado_a", "enviado_por", "tipo", "limite_referencia");
