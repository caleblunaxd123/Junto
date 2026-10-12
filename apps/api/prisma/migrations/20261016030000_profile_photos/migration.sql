-- Profile photos uploaded in JUNTO (additive).
CREATE TABLE "fotos_perfil" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "usuario_id" UUID NOT NULL,
    "mime" VARCHAR(20) NOT NULL,
    "datos" BYTEA NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fotos_perfil_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "fotos_perfil_usuario_id_key" ON "fotos_perfil"("usuario_id");

ALTER TABLE "fotos_perfil" ADD CONSTRAINT "fotos_perfil_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;
