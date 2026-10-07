-- Baseline of the JUNTO schema. Existing databases created from schema.sql + patches
-- must NOT run this file: mark it applied with `npx prisma migrate resolve --applied 0_init`
-- (see apps/api/prisma/MIGRATIONS.md).

-- CreateTable
CREATE TABLE "usuarios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "celular" VARCHAR(12),
    "password_hash" VARCHAR(255) NOT NULL,
    "foto_url" VARCHAR(500),
    "email_verificado" BOOLEAN NOT NULL DEFAULT false,
    "otp_code" VARCHAR(6),
    "otp_expires" TIMESTAMP(3),
    "otp_purpose" VARCHAR(20),
    "otp_attempts" INTEGER NOT NULL DEFAULT 0,
    "fecha_registro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "expo_push_token" VARCHAR(200),

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cuentas_rapidas" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "creado_por" UUID NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "datos" JSONB NOT NULL,
    "recibidos" JSONB NOT NULL DEFAULT '[]',
    "aportes" JSONB NOT NULL DEFAULT '{}',
    "historial" JSONB NOT NULL DEFAULT '[]',
    "archivada" BOOLEAN NOT NULL DEFAULT false,
    "solicitud_id" VARCHAR(80),
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_actualizacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cuentas_rapidas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(100) NOT NULL,
    "descripcion" TEXT,
    "tipo" VARCHAR(20) NOT NULL DEFAULT 'amigos',
    "creado_por" UUID NOT NULL,
    "link_invitacion" VARCHAR(50),
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grupos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grupo_miembros" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "rol" VARCHAR(10) NOT NULL DEFAULT 'miembro',
    "fecha_union" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "grupo_miembros_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gastos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "descripcion" VARCHAR(200) NOT NULL,
    "monto_total" INTEGER NOT NULL,
    "pagado_por" UUID NOT NULL,
    "categoria" VARCHAR(30) NOT NULL DEFAULT 'otro',
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creado_por" UUID NOT NULL,
    "foto_url" VARCHAR(500),
    "notas" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "gastos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gasto_participantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gasto_id" UUID NOT NULL,
    "usuario_id" UUID NOT NULL,
    "monto_asignado" INTEGER NOT NULL,
    "pagado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_pago" TIMESTAMP(3),

    CONSTRAINT "gasto_participantes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pagos" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "pagador_id" UUID NOT NULL,
    "receptor_id" UUID NOT NULL,
    "monto" INTEGER NOT NULL,
    "fee_junto" INTEGER,
    "metodo" VARCHAR(20),
    "culqi_charge_id" VARCHAR(100),
    "estado" VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    "fecha_pago" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "nota" VARCHAR(100),
    "fecha_resolucion" TIMESTAMP(3),

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recordatorios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "enviado_por" UUID NOT NULL,
    "enviado_a" UUID NOT NULL,
    "grupo_id" UUID NOT NULL,
    "monto" INTEGER,
    "tipo" VARCHAR(20) NOT NULL,
    "tono" VARCHAR(20) NOT NULL DEFAULT 'suave',
    "mensaje" TEXT,
    "leido" BOOLEAN NOT NULL DEFAULT false,
    "fecha_envio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_lectura" TIMESTAMP(3),

    CONSTRAINT "recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "config_recordatorios" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "grupo_id" UUID NOT NULL,
    "configurado_por" UUID NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "frecuencia_dias" INTEGER NOT NULL DEFAULT 7,
    "hora_envio" TEXT NOT NULL DEFAULT '09:00',
    "fecha_inicio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "config_recordatorios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "fecha_expiracion" TIMESTAMP(3) NOT NULL,
    "revocado" BOOLEAN NOT NULL DEFAULT false,
    "fecha_creacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");

-- CreateIndex
CREATE INDEX "cuentas_rapidas_creado_por_fecha_creacion_idx" ON "cuentas_rapidas"("creado_por", "fecha_creacion");

-- CreateIndex
CREATE UNIQUE INDEX "cuentas_rapidas_creado_por_solicitud_id_key" ON "cuentas_rapidas"("creado_por", "solicitud_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupos_link_invitacion_key" ON "grupos"("link_invitacion");

-- CreateIndex
CREATE INDEX "grupo_miembros_usuario_id_idx" ON "grupo_miembros"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "grupo_miembros_grupo_id_usuario_id_key" ON "grupo_miembros"("grupo_id", "usuario_id");

-- CreateIndex
CREATE INDEX "gastos_grupo_id_idx" ON "gastos"("grupo_id");

-- CreateIndex
CREATE INDEX "gasto_participantes_gasto_id_idx" ON "gasto_participantes"("gasto_id");

-- CreateIndex
CREATE INDEX "gasto_participantes_usuario_id_idx" ON "gasto_participantes"("usuario_id");

-- CreateIndex
CREATE UNIQUE INDEX "gasto_participantes_gasto_id_usuario_id_key" ON "gasto_participantes"("gasto_id", "usuario_id");

-- CreateIndex
CREATE INDEX "pagos_pagador_id_idx" ON "pagos"("pagador_id");

-- CreateIndex
CREATE INDEX "recordatorios_enviado_a_idx" ON "recordatorios"("enviado_a");

-- AddForeignKey
ALTER TABLE "cuentas_rapidas" ADD CONSTRAINT "cuentas_rapidas_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupos" ADD CONSTRAINT "grupos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "grupo_miembros" ADD CONSTRAINT "grupo_miembros_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_pagado_por_fkey" FOREIGN KEY ("pagado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gastos" ADD CONSTRAINT "gastos_creado_por_fkey" FOREIGN KEY ("creado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_participantes" ADD CONSTRAINT "gasto_participantes_gasto_id_fkey" FOREIGN KEY ("gasto_id") REFERENCES "gastos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gasto_participantes" ADD CONSTRAINT "gasto_participantes_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_pagador_id_fkey" FOREIGN KEY ("pagador_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_receptor_id_fkey" FOREIGN KEY ("receptor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_enviado_por_fkey" FOREIGN KEY ("enviado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_enviado_a_fkey" FOREIGN KEY ("enviado_a") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recordatorios" ADD CONSTRAINT "recordatorios_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_recordatorios" ADD CONSTRAINT "config_recordatorios_grupo_id_fkey" FOREIGN KEY ("grupo_id") REFERENCES "grupos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "config_recordatorios" ADD CONSTRAINT "config_recordatorios_configurado_por_fkey" FOREIGN KEY ("configurado_por") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Only one payment per pair can wait for confirmation at a time (not expressible in Prisma schema).
CREATE UNIQUE INDEX "pagos_one_pending_pair" ON "pagos"("grupo_id", "pagador_id", "receptor_id") WHERE "estado" = 'reportado';
