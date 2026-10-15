-- Existing groups keep the simplified plan they already show; new groups default to person-to-person debts.
ALTER TABLE "grupos" ADD COLUMN "simplificar_deudas" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "grupos" ALTER COLUMN "simplificar_deudas" SET DEFAULT false;
