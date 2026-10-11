-- Members added by name only ("Ana"), before they have JUNTO. They live in the ledger like anyone
-- else; when the real person joins they take over that place. Additive: existing rows unchanged.
ALTER TABLE "usuarios" ADD COLUMN "sin_cuenta" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "grupo_miembros" ADD COLUMN "codigo_personal" VARCHAR(40);
CREATE UNIQUE INDEX "grupo_miembros_codigo_personal_key" ON "grupo_miembros"("codigo_personal");
