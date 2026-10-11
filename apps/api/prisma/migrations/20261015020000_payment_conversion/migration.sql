ALTER TABLE "pagos" ADD COLUMN "moneda_origen" CHAR(3), ADD COLUMN "monto_origen" INTEGER, ADD COLUMN "tipo_cambio" VARCHAR(20);
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_conversion_complete" CHECK (
  ("moneda_origen" IS NULL AND "monto_origen" IS NULL AND "tipo_cambio" IS NULL) OR
  ("moneda_origen" IS NOT NULL AND "moneda_origen" IN ('PEN', 'COP', 'USD', 'EUR', 'MXN', 'BRL') AND
   "monto_origen" IS NOT NULL AND "monto_origen" > 0 AND "monto_origen" <= 999999999 AND "tipo_cambio" IS NOT NULL)
);
