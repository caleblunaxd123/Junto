-- Additive: what each payer put money into ("Tour", "Cena"). Optional; old rows stay empty.
ALTER TABLE "gasto_aportes" ADD COLUMN "concepto" VARCHAR(80);
