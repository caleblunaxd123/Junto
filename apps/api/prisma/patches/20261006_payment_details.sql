ALTER TABLE pagos ADD COLUMN IF NOT EXISTS nota VARCHAR(100);
ALTER TABLE pagos ADD COLUMN IF NOT EXISTS fecha_resolucion TIMESTAMP(3);
CREATE UNIQUE INDEX IF NOT EXISTS pagos_one_pending_pair
ON pagos(grupo_id, pagador_id, receptor_id) WHERE estado = 'reportado';
