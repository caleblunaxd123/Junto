-- Payment vouchers read by OCR, admin approval of payments, and comments on expenses and payments.
-- Additive: existing groups keep "receptor" (only who receives approves), so nothing changes for them.
-- AlterTable
ALTER TABLE "grupos" ADD COLUMN     "aprobacion_pagos" VARCHAR(20) NOT NULL DEFAULT 'receptor';

-- AlterTable
ALTER TABLE "pagos" ADD COLUMN     "resuelto_por" UUID;

-- CreateTable
CREATE TABLE "comprobantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "subido_por" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "pago_id" UUID,
    "hash" CHAR(64) NOT NULL,
    "app" VARCHAR(20),
    "monto_leido" INTEGER,
    "operacion" VARCHAR(24),
    "destinatario_leido" VARCHAR(80),
    "fecha_leida" DATE,
    "codigo_seguridad" VARCHAR(6),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comprobante_imagenes" (
    "comprobante_id" UUID NOT NULL,
    "mime" VARCHAR(20) NOT NULL,
    "datos" BYTEA NOT NULL,

    CONSTRAINT "comprobante_imagenes_pkey" PRIMARY KEY ("comprobante_id")
);

-- CreateTable
CREATE TABLE "comentarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "gasto_id" UUID,
    "pago_id" UUID,
    "autor_id" UUID NOT NULL,
    "texto" VARCHAR(500) NOT NULL,
    "eliminado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reportes_comentarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "comentario_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "motivo" VARCHAR(200),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reportes_comentarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "comprobantes_pago_id_key" ON "comprobantes"("pago_id");

-- CreateIndex
CREATE INDEX "comprobantes_subido_por_fecha_creacion_idx" ON "comprobantes"("subido_por", "fecha_creacion");

-- CreateIndex
CREATE INDEX "comprobantes_hash_idx" ON "comprobantes"("hash");

-- CreateIndex
CREATE INDEX "comprobantes_operacion_idx" ON "comprobantes"("operacion");

-- CreateIndex
CREATE INDEX "comentarios_gasto_id_fecha_creacion_idx" ON "comentarios"("gasto_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "comentarios_pago_id_fecha_creacion_idx" ON "comentarios"("pago_id", "fecha_creacion");

-- CreateIndex
CREATE INDEX "comentarios_autor_id_fecha_creacion_idx" ON "comentarios"("autor_id", "fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "reportes_comentarios_comentario_id_usuario_id_key" ON "reportes_comentarios"("comentario_id", "usuario_id");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_resuelto_por_fkey" FOREIGN KEY ("resuelto_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_subido_por_fkey" FOREIGN KEY ("subido_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comprobante_imagenes" ADD CONSTRAINT "comprobante_imagenes_comprobante_id_fkey" FOREIGN KEY ("comprobante_id") REFERENCES "comprobantes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_autor_id_fkey" FOREIGN KEY ("autor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_comentarios" ADD CONSTRAINT "reportes_comentarios_comentario_id_fkey" FOREIGN KEY ("comentario_id") REFERENCES "comentarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reportes_comentarios" ADD CONSTRAINT "reportes_comentarios_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guards Prisma cannot express.
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_aprobacion_pagos_check" CHECK ("aprobacion_pagos" IN ('receptor', 'administrador'));
ALTER TABLE "comentarios" ADD CONSTRAINT "comentarios_un_destino_check" CHECK (num_nonnulls("gasto_id", "pago_id") = 1);
