import { marked } from "marked";
import sanitizeHtml from "sanitize-html";
import type { SessionPayload } from "./auth.js";

export type Toegang = "gratis" | "pro";

/** "Hoe AI je administratie 2 uur per week kan besparen" → "hoe-ai-je-administratie-2-uur-per-week-kan-besparen" */
export function maakSlug(titel: string): string {
  return titel
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // é → e
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

/** Geschatte leestijd in minuten (200 woorden per minuut, minimaal 1). */
/**
 * Adres van de omslagfoto. Het versienummer (tijdstip van de laatste wijziging) maakt van elke
 * nieuwe versie een nieuw adres: zo mag de browser de foto een jaar bewaren, en ziet iedereen
 * toch meteen een nieuwe foto als Job die vervangt.
 */
export function coverPad(slug: string, bijgewerktOp?: Date | null): string {
  const pad = `/api/artikelen/${encodeURIComponent(slug)}/cover`;
  return bijgewerktOp ? `${pad}?v=${bijgewerktOp.getTime()}` : pad;
}

export function leestijdMinuten(markdown: string): number {
  const woorden = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
  return Math.max(1, Math.round(woorden / 200));
}

// Alleen Job schrijft artikelen, maar de HTML gaat wél naar elke bezoeker. Opschonen kost
// niets en voorkomt dat één geplakt stuk HTML (bijv. een embed van een andere site) scripts
// meeneemt naar de lezers.
const TOEGESTANE_TAGS = [
  "h2", "h3", "h4", "p", "br", "hr", "strong", "em", "del", "blockquote",
  "ul", "ol", "li", "a", "code", "pre", "img", "table", "thead", "tbody", "tr", "th", "td",
];

/**
 * Vaste kopjes die de site als eigen blok toont, zodat een lang artikel afwisseling krijgt
 * zonder dat er iets aan de tekst verandert. De sectie loopt van het kopje tot het volgende h2.
 */
const BLOKKEN: { kop: RegExp; klasse: string }[] = [
  { kop: /^(wat betekent dit voor jou|waarom dit jou aangaat)/i, klasse: "blok blok-jou" },
  { kop: /^(morgen al beginnen|wat kun je nu al doen)/i, klasse: "blok blok-actie" },
  {
    kop: /^(wat (het onderzoek|zegt het onderzoek|weten we nog) n[ií][eé]t|wat (het|kan het) (\(nog\) |nog )?niet|wat we nog niet weten|wat is nog niet besloten|(de )?kanttekeningen|hoe voorzichtig moet je zijn)/i,
    klasse: "blok blok-letop",
  },
  { kop: /^bronnen$/i, klasse: "blok-bronnen" },
];

/**
 * Zet de vaste secties in een eigen <section> en maakt van een citaat dat begint met
 * "**In het kort**" een samenvattingsblok. Werkt op HTML die al is opgeschoond: er komen
 * alleen vaste tags en klassen bij, niets uit de tekst zelf.
 */
export function zetBlokken(html: string): string {
  const metBlokken = html
    .split(/(?=<h2[\s>])/)
    .map((deel) => {
      const kop = deel.match(/^<h2[^>]*>([\s\S]*?)<\/h2>/);
      if (!kop) return deel;
      const tekst = kop[1].replace(/<[^>]+>/g, "").trim();
      const blok = BLOKKEN.find((b) => b.kop.test(tekst));
      return blok ? `<section class="${blok.klasse}">\n${deel.trim()}\n</section>\n` : deel;
    })
    .join("");
  return metBlokken.replace(
    /<blockquote>\s*<p><strong>In het kort:?<\/strong><\/p>/gi,
    '<blockquote class="blok blok-kort">\n<p class="blok-kicker">In het kort</p>',
  );
}

export function renderMarkdown(markdown: string): string {
  return zetBlokken(opgeschoond(markdown));
}

function opgeschoond(markdown: string): string {
  const ruweHtml = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
  return sanitizeHtml(ruweHtml, {
    allowedTags: TOEGESTANE_TAGS,
    allowedAttributes: {
      a: ["href", "title", "rel", "target"],
      img: ["src", "alt", "title"],
      code: ["class"],
    },
    allowedSchemes: ["https", "http", "mailto"],
    // Een h1 in de inhoud zou concurreren met de titel van het artikel zelf.
    transformTags: {
      h1: "h2",
      a: (tagName, attribs) => {
        const extern = /^https?:\/\//.test(attribs.href ?? "");
        return {
          tagName,
          attribs: extern ? { ...attribs, target: "_blank", rel: "noopener noreferrer" } : attribs,
        };
      },
    },
  });
}

/**
 * Mag deze bezoeker het volledige artikel lezen?
 * - Gratis: iedereen met een (gratis) account.
 * - Pro: alleen leden met een Pro-abonnement, en de admin.
 */
export function magVolledigLezen(
  toegang: string,
  bezoeker: { rol: SessionPayload["rol"]; abonnement: string } | null,
): boolean {
  // Zonder account niets te lezen, ook geen gratis artikel: een gratis account is de prijs.
  // Wat een bezoeker wél krijgt is de etalage (titel, samenvatting, afbeelding).
  if (!bezoeker) return false;
  if (toegang !== "pro") return true;
  return bezoeker.rol === "admin" || bezoeker.abonnement === "pro";
}

/** Waarom iemand een Pro-artikel niet kan lezen — de frontend kiest daarop de juiste tekst. */
export function vergrendelReden(
  bezoeker: { rol: SessionPayload["rol"]; abonnement: string } | null,
): "inloggen" | "pro_nodig" {
  return bezoeker ? "pro_nodig" : "inloggen";
}

// Artikelen die binnen deze tijd na elkaar zijn aangemaakt, horen bij dezelfde import.
const IMPORT_PAUZE_MS = 10 * 60 * 1000;

/**
 * Volgorde op de site (bovenaan eerst) voor artikelen die in één keer gepubliceerd worden. Een
 * import maakt zijn artikelen vlak na elkaar aan, in de volgorde van de bestanden. De nieuwste
 * import komt bovenaan, en binnen een import het eerste bestand (01, meestal het hoofdartikel).
 */
export function publicatieVolgorde<T extends { aangemaaktOp: Date }>(artikelen: T[]): T[] {
  const opTijd = [...artikelen].sort((a, b) => a.aangemaaktOp.getTime() - b.aangemaaktOp.getTime());
  const groepen: T[][] = [];
  for (const artikel of opTijd) {
    const groep = groepen.at(-1);
    const vorige = groep?.at(-1);
    if (groep && vorige && artikel.aangemaaktOp.getTime() - vorige.aangemaaktOp.getTime() <= IMPORT_PAUZE_MS) groep.push(artikel);
    else groepen.push([artikel]);
  }
  return groepen.reverse().flat();
}
