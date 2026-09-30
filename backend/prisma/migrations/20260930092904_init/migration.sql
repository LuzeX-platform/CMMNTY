-- CreateTable
CREATE TABLE "Gebruiker" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "wachtwoordHash" TEXT NOT NULL,
    "naam" TEXT NOT NULL,
    "rol" TEXT NOT NULL DEFAULT 'lid',
    "abonnement" TEXT NOT NULL DEFAULT 'gratis',
    "emailBevestigdOp" TIMESTAMP(3),
    "bevestigTokenHash" TEXT,
    "resetTokenHash" TEXT,
    "resetTokenVerlooptOp" TIMESTAMP(3),
    "nieuwsbrief" BOOLEAN NOT NULL DEFAULT true,
    "mislukteInlogpogingen" INTEGER NOT NULL DEFAULT 0,
    "vergrendeldTot" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Gebruiker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profiel" (
    "gebruikerId" TEXT NOT NULL,
    "weergavenaam" TEXT NOT NULL,
    "praktijknaam" TEXT,
    "specialismen" TEXT[],
    "telefoon" TEXT,
    "website" TEXT,
    "contactEmail" TEXT,
    "bio" VARCHAR(250),
    "regio" TEXT,
    "gepubliceerd" BOOLEAN NOT NULL DEFAULT false,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profiel_pkey" PRIMARY KEY ("gebruikerId")
);

-- CreateTable
CREATE TABLE "Artikel" (
    "id" TEXT NOT NULL,
    "titel" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "samenvatting" TEXT NOT NULL,
    "inhoud" TEXT NOT NULL,
    "toegang" TEXT NOT NULL DEFAULT 'gratis',
    "categorie" TEXT,
    "auteurNaam" TEXT NOT NULL DEFAULT 'Job',
    "coverAfbeelding" BYTEA,
    "coverMime" TEXT,
    "gepubliceerdOp" TIMESTAMP(3),
    "aangemaaktOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bijgewerktOp" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artikel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NieuwsbriefVerzending" (
    "id" TEXT NOT NULL,
    "verstuurdOp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "segment" TEXT NOT NULL,
    "artikelIds" TEXT[],
    "aantalOntvangers" INTEGER NOT NULL,
    "aanleiding" TEXT NOT NULL DEFAULT 'automatisch',

    CONSTRAINT "NieuwsbriefVerzending_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Instellingen" (
    "id" TEXT NOT NULL DEFAULT 'standaard',
    "nieuwsbriefFrequentie" TEXT NOT NULL DEFAULT 'wekelijks',

    CONSTRAINT "Instellingen_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_email_key" ON "Gebruiker"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_bevestigTokenHash_key" ON "Gebruiker"("bevestigTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Gebruiker_resetTokenHash_key" ON "Gebruiker"("resetTokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "Artikel_slug_key" ON "Artikel"("slug");

-- CreateIndex
CREATE INDEX "Artikel_gepubliceerdOp_idx" ON "Artikel"("gepubliceerdOp");

-- CreateIndex
CREATE INDEX "NieuwsbriefVerzending_verstuurdOp_idx" ON "NieuwsbriefVerzending"("verstuurdOp");

-- AddForeignKey
ALTER TABLE "Profiel" ADD CONSTRAINT "Profiel_gebruikerId_fkey" FOREIGN KEY ("gebruikerId") REFERENCES "Gebruiker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
