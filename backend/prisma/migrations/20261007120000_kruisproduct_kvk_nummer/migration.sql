-- AlterTable
ALTER TABLE "Gebruiker" ADD COLUMN     "kruisproduct_kvk_nummer" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_kruisproduct_kvk_nummer_key" ON "Gebruiker"("kruisproduct_kvk_nummer");
