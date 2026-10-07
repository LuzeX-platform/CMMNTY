import "dotenv/config";
import { prisma } from "./db.js";
import { controleerKruisproductStatus } from "./luzexKruisproduct.js";

// Draait dagelijks als losse Render-cronjob (zie render.yaml), zelfde opzet als
// nieuwsbriefCron.ts. Filter is bewust `kruisproductKvkNummer` en NIET `abonnementBron`: alleen
// een rij met een opgeslagen kvk-nummer is ooit via de nieuwe claim-route tot stand gekomen, en
// dus de enige die deze cron mag intrekken. Een handmatige toekenning door de admin (die veld
// altijd op null laat, zie admin.ts) raakt dit script nooit aan, hoe vaak het ook draait.
async function main() {
  const leden = await prisma.gebruiker.findMany({
    where: { kruisproductKvkNummer: { not: null } },
    select: { id: true, abonnement: true, kruisproductKvkNummer: true },
  });
  let ingetrokken = 0;
  let bevestigd = 0;
  for (const lid of leden) {
    const actief = await controleerKruisproductStatus(lid.kruisproductKvkNummer!);
    if (actief) {
      if (lid.abonnement !== "pro") {
        await prisma.gebruiker.update({ where: { id: lid.id }, data: { abonnement: "pro", abonnementBron: "accrd" } });
      }
      bevestigd++;
    } else {
      await prisma.gebruiker.update({
        where: { id: lid.id },
        data: { abonnement: "gratis", abonnementBron: null, kruisproductKvkNummer: null },
      });
      ingetrokken++;
    }
  }
  console.log(`[kruisproduct] ${leden.length} gecontroleerd, ${bevestigd} nog actief, ${ingetrokken} ingetrokken.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
