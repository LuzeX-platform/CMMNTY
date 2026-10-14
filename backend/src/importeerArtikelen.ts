import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { prisma } from "./db.js";
import {
  COVER_MAX_BYTES,
  COVER_MIME,
  coverVan,
  leesArtikelBestand,
  type GeimporteerdArtikel,
} from "./artikelImport.js";

// Zet de Markdown-bestanden uit content/artikelen/ in de database, als CONCEPT.
//
//   Lokaal:  npm run artikelen:importeren
//   Render:  node dist/importeerArtikelen.js            (in de Render Shell)
//
// Afspraken:
// - Bestaat de slug nog niet: het artikel wordt aangemaakt, als concept. Staat er in de
//   frontmatter `cover: afbeeldingen/naam.jpg`, dan krijgt het die afbeelding meteen mee;
//   anders geen afbeelding (toe te voegen in het adminpanel).
// - Bestaat de slug al: overgeslagen. Wat Job in het adminpanel heeft aangepast, blijft staan.
//   Twee keer draaien levert dus nooit dubbele artikelen op.
// - Met --force worden bestaande artikelen wél overschreven (titel, samenvatting, tekst,
//   toegang, categorie, auteur). Afbeelding en publicatiestatus blijven ook dan ongemoeid.
// - Met --afbeeldingen-aanvullen krijgt een bestaand artikel dat nog GEEN afbeelding heeft alsnog
//   de cover uit zijn bestand. Verder verandert er niets aan dat artikel (tekst, status,
//   publicatiedatum blijven staan), en een afbeelding die er al is wordt nooit vervangen.
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
  const aanvullen = args.includes("--afbeeldingen-aanvullen");
  const map = path.resolve(args.find((a) => !a.startsWith("--")) ?? STANDAARD_MAP);

  if (!fs.existsSync(map)) throw new Error(`Map niet gevonden: ${map}`);
  const bestanden = zoekBestanden(map);
  if (bestanden.length === 0) throw new Error(`Geen .md-bestanden gevonden in ${map}`);

  // Eerst alles lezen en controleren: één fout bestand mag niet halverwege de import opduiken.
  // Ook de coverafbeeldingen worden vooraf gecontroleerd en ingelezen.
  type Cover = { coverAfbeelding: Buffer; coverMime: string };
  const artikelen: { bestand: string; artikel: GeimporteerdArtikel; cover: Cover | null }[] = bestanden.map((pad) => {
    const bestand = path.relative(map, pad);
    const tekst = fs.readFileSync(pad, "utf8");
    const coverPad = coverVan(tekst, bestand);
    let cover: Cover | null = null;
    if (coverPad) {
      const volledig = path.join(path.dirname(pad), coverPad);
      if (!fs.existsSync(volledig)) throw new Error(`${bestand}: coverafbeelding ${coverPad} niet gevonden`);
      const bytes = fs.readFileSync(volledig);
      if (bytes.length > COVER_MAX_BYTES) throw new Error(`${bestand}: coverafbeelding ${coverPad} is groter dan 2 MB`);
      cover = { coverAfbeelding: bytes, coverMime: COVER_MIME[path.extname(volledig).toLowerCase()] };
    }
    return { bestand, artikel: leesArtikelBestand(tekst, bestand), cover };
  });
  const slugs = artikelen.map((a) => a.artikel.slug);
  const dubbel = slugs.find((s, i) => slugs.indexOf(s) !== i);
  if (dubbel) throw new Error(`Slug "${dubbel}" komt in meer dan één bestand voor`);

  const opties = [force && "--force", aanvullen && "--afbeeldingen-aanvullen"].filter(Boolean).join(", ");
  console.log(`${artikelen.length} artikel(en) gevonden in ${map}${opties ? ` (met ${opties})` : ""}\n`);
  const telling = { aangemaakt: 0, overgeslagen: 0, overschreven: 0, aangevuld: 0 };

  for (const { bestand, artikel, cover } of artikelen) {
    const bestaand = await prisma.artikel.findUnique({
      where: { slug: artikel.slug },
      select: { id: true, coverMime: true },
    });
    if (!bestaand) {
      // Geen gepubliceerdOp: een concept, te publiceren in het adminpanel.
      await prisma.artikel.create({ data: { ...artikel, ...cover, gepubliceerdOp: null } });
      telling.aangemaakt++;
      console.log(`  + aangemaakt (concept${cover ? ", met afbeelding" : ""})  ${artikel.slug}`);
      continue;
    }

    let aangeraakt = false;
    if (force) {
      await prisma.artikel.update({ where: { id: bestaand.id }, data: artikel });
      telling.overschreven++;
      aangeraakt = true;
      console.log(`  ! overschreven          ${artikel.slug}`);
    }
    if (aanvullen && cover && !bestaand.coverMime) {
      // updateMany met coverMime: null in de voorwaarde: heeft iemand intussen zelf een
      // afbeelding geüpload, dan blijft die staan.
      const { count } = await prisma.artikel.updateMany({ where: { id: bestaand.id, coverMime: null }, data: cover });
      if (count > 0) {
        telling.aangevuld++;
        aangeraakt = true;
        console.log(`  + afbeelding toegevoegd  ${artikel.slug}`);
      }
    }
    if (!aangeraakt) {
      telling.overgeslagen++;
      const reden = aanvullen && cover && bestaand.coverMime ? "heeft al een afbeelding" : "bestaat al";
      console.log(`  = ${reden}, overgeslagen  ${artikel.slug}  (${bestand})`);
    }
  }

  console.log(
    `\nKlaar: ${telling.aangemaakt} aangemaakt, ${telling.overgeslagen} overgeslagen` +
      (force ? `, ${telling.overschreven} overschreven` : "") +
      (aanvullen ? `, ${telling.aangevuld} afbeelding(en) toegevoegd` : "") +
      ". Er is niets gepubliceerd en geen nieuwsbrief verstuurd.",
  );
}

main()
  .catch((err) => {
    console.error(`Import mislukt: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
