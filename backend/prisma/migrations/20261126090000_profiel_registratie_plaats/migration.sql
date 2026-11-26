-- Netwerkprofiel: plaats van de praktijk en registraties (BIG, SKJ, AGB, beroepsvereniging),
-- plus de datum waarop Job de registratie heeft gecontroleerd. Alles optioneel: bestaande
-- profielen blijven zoals ze zijn.

-- AlterTable
ALTER TABLE "Profiel" ADD COLUMN     "agbCode" TEXT,
ADD COLUMN     "beroepsvereniging" TEXT,
ADD COLUMN     "bigNummer" TEXT,
ADD COLUMN     "plaats" TEXT,
ADD COLUMN     "registratieGecontroleerdOp" TIMESTAMP(3),
ADD COLUMN     "skjNummer" TEXT;
