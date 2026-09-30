import "dotenv/config";
import { prisma } from "./db.js";
import { isVerzenddag } from "./nieuwsbrief.js";
import { leesFrequentie, verstuurNieuwsbrief } from "./nieuwsbriefVersturen.js";

// Draait dagelijks als losse Render-cronjob (zie render.yaml) — bewust geen timer in de
// webservice, net als de herinneringen in ACCRD: bij meerdere instances zou een timer dubbel
// versturen. Dit script beslist zelf of vandaag een verzenddag is, zodat Job de frequentie in
// het adminpaneel kan wijzigen zonder aan de cron-instelling te komen.
async function main() {
  const frequentie = await leesFrequentie();
  const nu = new Date();
  if (!isVerzenddag(frequentie, nu)) {
    console.log(`[nieuwsbrief] Geen verzenddag (frequentie: ${frequentie}).`);
    return;
  }
  const resultaten = await verstuurNieuwsbrief("automatisch", nu);
  for (const r of resultaten) {
    console.log(
      `[nieuwsbrief] ${r.segment}: ${r.overgeslagen ?? `${r.aantalArtikelen} artikelen aan ${r.aantalOntvangers} ontvangers`}`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
