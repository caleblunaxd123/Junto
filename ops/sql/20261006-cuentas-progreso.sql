ALTER TABLE cuentas_rapidas ADD COLUMN IF NOT EXISTS aportes JSONB NOT NULL DEFAULT '{}';
ALTER TABLE cuentas_rapidas ADD COLUMN IF NOT EXISTS historial JSONB NOT NULL DEFAULT '[]';
ALTER TABLE cuentas_rapidas ADD COLUMN IF NOT EXISTS archivada BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE cuentas_rapidas ADD COLUMN IF NOT EXISTS solicitud_id VARCHAR(80);
CREATE UNIQUE INDEX IF NOT EXISTS cuentas_rapidas_creado_por_solicitud_id_key ON cuentas_rapidas(creado_por, solicitud_id);
