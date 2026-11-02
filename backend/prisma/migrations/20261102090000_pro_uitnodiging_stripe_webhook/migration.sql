-- Pro cadeau op e-mailadres, en het geheim van een met één klik aangemaakte Stripe-webhook.

-- AlterTable
ALTER TABLE "Instellingen" ADD COLUMN     "stripeWebhookGeheim" TEXT,
ADD COLUMN     "stripeWebhookId" TEXT;

-- CreateTable
CREATE TABLE "ProUitnodiging" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ingewisseldOp" TIMESTAMP(3),
    "ingetrokkenOp" TIMESTAMP(3),

    CONSTRAINT "ProUitnodiging_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ProUitnodiging_email_key" ON "ProUitnodiging"("email");
