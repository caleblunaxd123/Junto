-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "google_id" VARCHAR(64);

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_google_id_key" ON "usuarios"("google_id");

