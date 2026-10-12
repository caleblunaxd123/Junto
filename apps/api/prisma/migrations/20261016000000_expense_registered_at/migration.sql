-- When an expense was written down, so the group chat shows it in order. `fecha` stays the day of
-- the expense (chosen in the form, often midnight). Existing rows keep their expense date.
ALTER TABLE "gastos" ADD COLUMN "fecha_registro" TIMESTAMP(3);
UPDATE "gastos" SET "fecha_registro" = "fecha";
ALTER TABLE "gastos" ALTER COLUMN "fecha_registro" SET NOT NULL;
ALTER TABLE "gastos" ALTER COLUMN "fecha_registro" SET DEFAULT CURRENT_TIMESTAMP;
