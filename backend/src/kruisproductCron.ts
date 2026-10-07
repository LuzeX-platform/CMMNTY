import "dotenv/config";
import { prisma } from "./db.js";
import { controleerKruisproductPro } from "./luzexEntitlement.js";

// Draait dagelijks als losse Render-cronjob (zie render.yaml), zelfde opzet als
// nieuwsbriefCron.ts. Alleen leden met abonnementBron gezet komen hier aan bod — een
// handmatige toekenning door de admin (abonnementBron null) raakt dit script nooit aan. Wie
// zijn ACCRD- of SCRNN-account inmiddels kwijt is, verliest hier zijn gratis CMMNTY-Pro weer;
// wie een nieuwe koppeling heeft gekregen sinds de vorige run, krijgt 'm hier alsnog.
async function main() {
  const leden = await prisma.gebruiker.findMany({
    where: { abonnementBron: { not: null } },
    select: { id: true, email: true, abonnement: true, abonnementBron: true },
  });
  let ingetrokken = 0;
  let bevestigd = 0;
  for (const lid of leden) {
    const bron = await controleerKruisproductPro(lid.email);
    if (bron) {
      if (lid.abonnement !== "pro" || lid.abonnementBron !== bron) {
        await prisma.gebruiker.update({ where: { id: lid.id }, data: { abonnement: "pro", abonnementBron: bron } });
      }
      bevestigd++;
    } else {
      await prisma.gebruiker.update({ where: { id: lid.id }, data: { abonnement: "gratis", abonnementBron: null } });
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
