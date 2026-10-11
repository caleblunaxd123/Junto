ALTER TABLE "comprobantes" ADD COLUMN "moneda_leida" CHAR(3);
-- Existing readers proposed only soles. Preserve that meaning; unread drafts stay unknown.
UPDATE "comprobantes" SET "moneda_leida" = 'PEN' WHERE "monto_leido" IS NOT NULL;
