-- A bill split in N equal parts: parts nobody holds yet stay with whoever paid, and each person who
-- joins the group takes one. Additive: existing expenses keep partes = NULL and never change.
ALTER TABLE "gastos" ADD COLUMN "partes" INTEGER;
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_partes_check" CHECK ("partes" IS NULL OR "partes" BETWEEN 2 AND 100);

-- The join notice says which part the newcomer took.
ALTER TABLE "avisos_grupo" ADD COLUMN "parte" INTEGER;

-- Group chat: a comment with neither expense nor payment is a message to the whole group.
-- Expenses and payments are never hard-deleted, so no thread turns into a group message.
ALTER TABLE "comentarios" DROP CONSTRAINT "comentarios_un_destino_check";
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_un_destino_check" CHECK (num_nonnulls("gasto_id", "pago_id") <= 1);
CREATE INDEX "comentarios_grupo_id_fecha_creacion_idx" ON "comentarios"("grupo_id", "fecha_creacion");

-- What the group is for: "cobranza" (someone paid, the rest pay back) or "division" (everyone puts in
-- toward a goal). Existing groups stay NULL: free expenses, exactly as before.
ALTER TABLE "grupos" ADD COLUMN "modo" VARCHAR(12);
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_modo_check" CHECK ("modo" IS NULL OR "modo" IN ('cobranza', 'division'));

-- Deadline to pay: people who still owe get automatic reminders as it approaches and after it.
ALTER TABLE "grupos" ADD COLUMN "fecha_limite" TIMESTAMP(3);
CREATE INDEX "grupos_fecha_limite_idx" ON "grupos"("fecha_limite");

-- Unread count per group, like a chat: the last time each member opened it.
ALTER TABLE "grupo_miembros" ADD COLUMN "ultima_lectura" TIMESTAMP(3);
