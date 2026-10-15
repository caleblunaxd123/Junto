-- CreateTable
CREATE TABLE "presupuestos_grupo" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "categoria" VARCHAR(30) NOT NULL,
    "monto_mensual" INTEGER NOT NULL,
    "actualizado_por" UUID NOT NULL,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "presupuestos_grupo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presupuestos_grupo_grupo_id_categoria_key" ON "presupuestos_grupo"("grupo_id", "categoria");

-- AddForeignKey
ALTER TABLE "presupuestos_grupo" ADD CONSTRAINT "presupuestos_grupo_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

