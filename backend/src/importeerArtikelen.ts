import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";
import { leesArtikelBestand, type GeimporteerdArtikel } from "./artikelImport.js";

// Zet de Markdown-bestanden uit content/artikelen/ in de database, als CONCEPT.
//
//   Lokaal:  npm run artikelen:importeren
//   Render:  node dist/importeerArtikelen.js            (in de Render Shell)
//
// Afspraken:
// - Bestaat de slug nog niet: het artikel wordt aangemaakt, als concept, zonder afbeelding.
// - Bestaat de slug al: overgeslagen. Wat Job in het adminpanel heeft aangepast, blijft staan.
//   Twee keer draaien levert dus nooit dubbele artikelen op.
// - Met --force worden bestaande artikelen wél overschreven (titel, samenvatting, tekst,
//   toegang, categorie, auteur). Afbeelding en publicatiestatus blijven ook dan ongemoeid.
// - Er wordt nooit een nieuwsbrief verstuurd en nooit iets gepubliceerd. (De nieuwsbrief gaat
//   alleen uit via de cron of de knop in het adminpanel, en concepten gaan er nooit in mee.)
//
// Optioneel een map als argument, bijv. `node dist/importeerArtikelen.js content/artikelen/x`;
// standaard alle mappen onder content/artikelen/.

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Werkt vanuit src/ (tsx) en dist/ (productie): beide liggen twee niveaus onder de repo-root.
const STANDAARD_MAP = path.join(__dirname, "..", "..", "content", "artikelen");

function zoekBestanden(map: string): string[] {
  return fs
    .readdirSync(map, { withFileTypes: true })
    .flatMap((item) => {
      const pad = path.join(map, item.name);
      if (item.isDirectory()) return zoekBestanden(pad);
      return item.name.endsWith(".md") ? [pad] : [];
    })
    .sort();
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const map = path.resolve(args.find((a) => !a.startsWith("--")) ?? STANDAARD_MAP);

  if (!fs.existsSync(map)) throw new Error(`Map niet gevonden: ${map}`);
  const bestanden = zoekBestanden(map);
  if (bestanden.length === 0) throw new Error(`Geen .md-bestanden gevonden in ${map}`);

  // Eerst alles lezen en controleren: één fout bestand mag niet halverwege de import opduiken.
  const artikelen: { bestand: string; artikel: GeimporteerdArtikel }[] = bestanden.map((pad) => ({
    bestand: path.relative(map, pad),
    artikel: leesArtikelBestand(fs.readFileSync(pad, "utf8"), path.relative(map, pad)),
  }));
  const slugs = artikelen.map((a) => a.artikel.slug);
  const dubbel = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dubbel) throw new Error(`Slug "${dubbel}" komt in meer dan één bestand voor`);

  console.log(`${artikelen.length} artikel(en) gevonden in ${map}${force ? " (met --force)" : ""}\n`);
  const telling = { aangemaakt: 0, overgeslagen: 0, overschreven: 0 };

  for (const { bestand, artikel } of artikelen) {
    const bestaand = await prisma.artikel.findUnique({ where: { slug: artikel.slug }, select: { id: true } });
    if (!bestaand) {
      // Geen gepubliceerdOp en geen afbeelding: een concept, aan te vullen in het adminpanel.
      await prisma.artikel.create({ data: { ...artikel, gepubliceerdOp: null } });
      telling.aangemaakt++;
      console.log(`  + aangemaakt (concept)  ${artikel.slug}`);
    } else if (force) {
      await prisma.artikel.update({ where: { id: bestaand.id }, data: artikel });
      telling.overschreven++;
      console.log(`  ! overschreven          ${artikel.slug}`);
    } else {
      telling.overgeslagen++;
      console.log(`  = bestaat al, overgeslagen  ${artikel.slug}  (${bestand})`);
    }
  }

  console.log(
    `\nKlaar: ${telling.aangemaakt} aangemaakt, ${telling.overgeslagen} overgeslagen` +
      (force ? `, ${telling.overschreven} overschreven` : "") +
      ". Er is niets gepubliceerd en geen nieuwsbrief verstuurd.",
  );
}

main()
  .catch((err) => {
    console.error(`Import mislukt: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
