ALTER TABLE "grupos" ADD COLUMN "moneda" CHAR(3) NOT NULL DEFAULT 'PEN';
ALTER TABLE "grupos" ADD COLUMN "pais" VARCHAR(5);
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_moneda_check" CHECK ("moneda" IN ('PEN', 'COP', 'USD', 'EUR', 'MXN', 'BRL'));
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_pais_check" CHECK ("pais" IS NULL OR "pais" IN ('PE', 'CO', 'US', 'ES', 'MX', 'BR', 'OTHER'));
-- Metadata edits must never reinterpret existing expenses or payments.
CREATE FUNCTION junto_currency_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.moneda IS DISTINCT FROM OLD.moneda OR NEW.pais IS DISTINCT FROM OLD.pais THEN
    RAISE EXCEPTION 'Group currency and country cannot be changed';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER grupos_currency_immutable BEFORE UPDATE OF moneda, pais ON grupos
FOR EACH ROW EXECUTE FUNCTION junto_currency_immutable();
