-- AlterTable
ALTER TABLE "Gebruiker" ADD COLUMN     "stripe_abonnement_id" TEXT,
ADD COLUMN     "stripe_klant_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_stripe_klant_id_key" ON "Gebruiker"("stripe_klant_id");

