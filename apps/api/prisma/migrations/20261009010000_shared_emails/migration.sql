-- Summaries e-mailed by JUNTO on a person's behalf (idempotency, limits, status). Additive.
-- CreateTable
CREATE TABLE "correos_compartidos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "solicitud_id" VARCHAR(80) NOT NULL,
    "recurso_tipo" VARCHAR(20) NOT NULL,
    "recurso_id" UUID NOT NULL,
    "destinatario_hash" VARCHAR(64) NOT NULL,
    "destinatario_mascara" VARCHAR(80) NOT NULL,
    "estado" VARCHAR(12) NOT NULL,
    "proveedor_id" VARCHAR(200),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correos_compartidos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "correos_compartidos_usuario_id_fecha_creacion_idx" ON "correos_compartidos"("usuario_id", "fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "correos_compartidos_usuario_id_solicitud_id_key" ON "correos_compartidos"("usuario_id", "solicitud_id");

-- AddForeignKey
ALTER TABLE "correos_compartidos" ADD CONSTRAINT "correos_compartidos_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

