-- Invitations by e-mail or phone need the invited person's acceptance; payment lookups by group and
-- receiver get indexes. Additive: existing members and payments are untouched.
-- CreateTable
CREATE TABLE "invitaciones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "invitado_id" UUID NOT NULL,
    "invitado_por" UUID NOT NULL,
    "estado" VARCHAR(12) NOT NULL DEFAULT 'pendiente',
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_respuesta" TIMESTAMP(3),

    CONSTRAINT "invitaciones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invitaciones_invitado_id_estado_idx" ON "invitaciones"("invitado_id", "estado");

-- CreateIndex
CREATE INDEX "invitaciones_invitado_por_fecha_creacion_idx" ON "invitaciones"("invitado_por", "fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "invitaciones_grupo_id_invitado_id_key" ON "invitaciones"("grupo_id", "invitado_id");

-- CreateIndex
CREATE INDEX "pagos_grupo_id_idx" ON "pagos"("grupo_id");

-- CreateIndex
CREATE INDEX "pagos_receptor_id_idx" ON "pagos"("receptor_id");

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_id_fkey" FOREIGN KEY ("invitado_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_invitado_por_fkey" FOREIGN KEY ("invitado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Guard Prisma cannot express.
ALTER TABLE "invitaciones" ADD CONSTRAINT "invitaciones_estado_check" CHECK ("estado" IN ('pendiente', 'aceptada', 'rechazada'));
