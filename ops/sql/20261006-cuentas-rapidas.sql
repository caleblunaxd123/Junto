-- Additive migration. Review/back up production before applying there.
CREATE TABLE IF NOT EXISTS cuentas_rapidas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creado_por UUID NOT NULL REFERENCES usuarios(id),
  nombre VARCHAR(100) NOT NULL,
  datos JSONB NOT NULL,
  recibidos JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  fecha_creacion TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_actualizacion TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS cuentas_rapidas_creado_por_fecha_creacion_idx ON cuentas_rapidas(creado_por, fecha_creacion);
