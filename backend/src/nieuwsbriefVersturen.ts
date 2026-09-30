import { prisma } from "./db.js";
import { maakAfmeldToken } from "./auth.js";
import { verstuurMail } from "./mailer.js";
import {
  artikelenVoorSegment,
  bouwHtml,
  bouwTekst,
  onderwerp,
  periodeStart,
  type Frequentie,
  type NieuwsbriefArtikel,
  type Segment,
} from "./nieuwsbrief.js";

export function appUrl(): string {
  // APP_URL wint (eigen domein); anders het adres dat Render zelf meegeeft; lokaal localhost.
  const url = process.env.APP_URL || process.env.RENDER_EXTERNAL_URL || "http://localhost:4100";
  return url.replace(/\/+$/, "");
}

export async function leesFrequentie(): Promise<Frequentie> {
  const instellingen = await prisma.instellingen.findUnique({ where: { id: "standaard" } });
  const f = instellingen?.nieuwsbriefFrequentie;
  return f === "maandelijks" || f === "uit" ? f : "wekelijks";
}

async function vorigeVerzending(segment: Segment): Promise<Date | null> {
  const laatste = await prisma.nieuwsbriefVerzending.findFirst({
    where: { segment },
    orderBy: { verstuurdOp: "desc" },
  });
  return laatste?.verstuurdOp ?? null;
}

/** Welke artikelen zouden er nu in de nieuwsbrief van dit segment komen? Gebruikt door preview én versturen. */
export async function artikelenVoorNieuwsbrief(
  segment: Segment,
  frequentie: Frequentie,
  nu = new Date(),
): Promise<{ vanaf: Date; artikelen: NieuwsbriefArtikel[] }> {
  const vanaf = periodeStart(frequentie, nu, await vorigeVerzending(segment));
  const artikelen = await prisma.artikel.findMany({
    where: { gepubliceerdOp: { gt: vanaf, lte: nu } },
    orderBy: { gepubliceerdOp: "desc" },
    select: { id: true, titel: true, slug: true, samenvatting: true, toegang: true, auteurNaam: true, gepubliceerdOp: true },
  });
  return {
    vanaf,
    artikelen: artikelenVoorSegment(artikelen as NieuwsbriefArtikel[], segment),
  };
}

export function voorbeeldHtml(artikelen: NieuwsbriefArtikel[], frequentie: Frequentie, naam: string): string {
  return bouwHtml({ artikelen, frequentie, appUrl: appUrl(), naam, afmeldLink: `${appUrl()}/afmelden.html` });
}

export interface VerzendResultaat {
  segment: Segment;
  aantalArtikelen: number;
  aantalOntvangers: number;
  overgeslagen?: string;
}

/**
 * Verstuurt de nieuwsbrief voor beide segmenten. Een segment zonder nieuwe artikelen wordt
 * overgeslagen (een lege nieuwsbrief is ruis) en telt dan ook niet als verzending — de
 * artikelen schuiven gewoon door naar de volgende keer.
 */
export async function verstuurNieuwsbrief(
  aanleiding: "automatisch" | "handmatig",
  nu = new Date(),
): Promise<VerzendResultaat[]> {
  const frequentie = await leesFrequentie();
  // Handmatig versturen kan ook als de automatische nieuwsbrief uit staat; de tekst gaat dan
  // uit van een week.
  const tekstFrequentie: Frequentie = frequentie === "uit" ? "wekelijks" : frequentie;
  const resultaten: VerzendResultaat[] = [];

  for (const segment of ["gratis", "pro"] as const) {
    const { artikelen } = await artikelenVoorNieuwsbrief(segment, tekstFrequentie, nu);
    if (artikelen.length === 0) {
      resultaten.push({ segment, aantalArtikelen: 0, aantalOntvangers: 0, overgeslagen: "geen nieuwe artikelen" });
      continue;
    }

    // Pro-segment: Pro-leden en de admin (die ziet zo ook wat Pro-leden ontvangen).
    const ontvangers = await prisma.gebruiker.findMany({
      where: {
        nieuwsbrief: true,
        emailBevestigdOp: { not: null },
        ...(segment === "pro"
          ? { OR: [{ abonnement: "pro" }, { rol: "admin" }] }
          : { abonnement: { not: "pro" }, rol: { not: "admin" } }),
      },
      select: { id: true, email: true, naam: true },
    });

    let verstuurd = 0;
    for (const ontvanger of ontvangers) {
      const token = encodeURIComponent(maakAfmeldToken(ontvanger.id));
      const afmeldLink = `${appUrl()}/afmelden.html?token=${token}`;
      const opties = { artikelen, frequentie: tekstFrequentie, appUrl: appUrl(), naam: ontvanger.naam, afmeldLink };
      try {
        await verstuurMail({
          naar: ontvanger.email,
          onderwerp: onderwerp(tekstFrequentie, artikelen.length),
          tekst: bouwTekst(opties),
          html: bouwHtml(opties),
          // Eén-klik-afmelden in Gmail/Apple Mail; vereist voor bulkafzenders bij Gmail/Yahoo.
          headers: {
            "List-Unsubscribe": `<${appUrl()}/api/nieuwsbrief/afmelden-een-klik?token=${token}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
        verstuurd++;
      } catch (err) {
        // Eén kapot adres mag de rest van de verzending niet tegenhouden.
        console.error(`[nieuwsbrief] Versturen aan ${ontvanger.email} mislukt:`, err);
      }
    }

    await prisma.nieuwsbriefVerzending.create({
      data: { segment, artikelIds: artikelen.map((a) => a.id), aantalOntvangers: verstuurd, aanleiding, verstuurdOp: nu },
    });
    resultaten.push({ segment, aantalArtikelen: artikelen.length, aantalOntvangers: verstuurd });
  }
  return resultaten;
}
