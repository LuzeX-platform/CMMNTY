// Pure logica van de nieuwsbrief: wanneer versturen, welke artikelen, welke tekst. Geen
// database of mail hier, zodat dit los te testen is (test/nieuwsbrief.test.ts). Het versturen
// zelf staat in nieuwsbriefVersturen.ts.

export type Frequentie = "wekelijks" | "maandelijks" | "uit";
export type Segment = "gratis" | "pro";

/**
 * Is vandaag een verzenddag? De cron draait dagelijks; hier wordt bepaald of er vandaag iets
 * uit moet. Wekelijks = maandag, maandelijks = de 1e. Altijd in UTC, net als de cron zelf.
 */
export function isVerzenddag(frequentie: Frequentie, nu: Date): boolean {
  if (frequentie === "wekelijks") return nu.getUTCDay() === 1;
  if (frequentie === "maandelijks") return nu.getUTCDate() === 1;
  return false;
}

/**
 * Vanaf welk moment tellen artikelen mee? Vanaf de vorige verzending van dit segment, zodat
 * er nooit een artikel dubbel of helemaal niet in komt — ook niet als Job tussendoor
 * handmatig verstuurt of de frequentie wijzigt. Zonder eerdere verzending: één periode terug.
 */
export function periodeStart(frequentie: Frequentie, nu: Date, vorigeVerzending: Date | null): Date {
  if (vorigeVerzending) return vorigeVerzending;
  const start = new Date(nu);
  if (frequentie === "maandelijks") start.setUTCMonth(start.getUTCMonth() - 1);
  else start.setUTCDate(start.getUTCDate() - 7);
  return start;
}

export interface NieuwsbriefArtikel {
  id: string;
  titel: string;
  slug: string;
  samenvatting: string;
  toegang: string;
  auteurNaam: string;
  gepubliceerdOp: Date;
}

/** Gratis-leden krijgen alleen gratis artikelen; Pro-leden alles. */
export function artikelenVoorSegment<T extends { toegang: string }>(artikelen: T[], segment: Segment): T[] {
  return segment === "pro" ? artikelen : artikelen.filter((a) => a.toegang === "gratis");
}

export function onderwerp(frequentie: Frequentie, aantal: number): string {
  const periode = frequentie === "maandelijks" ? "Deze maand" : "Deze week";
  return `${periode} in zorgtech: ${aantal} ${aantal === 1 ? "nieuw artikel" : "nieuwe artikelen"}`;
}

function escapeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface BouwOpties {
  artikelen: NieuwsbriefArtikel[];
  frequentie: Frequentie;
  appUrl: string;
  naam: string;
  afmeldLink: string;
}

/**
 * HTML-versie. Inline stijlen en tabellen: mailprogramma's (Outlook voorop) negeren
 * stylesheets en flexbox. Kleuren zijn die van de huisstijl (greige achtergrond, grafiet
 * accent, diepbruin voor accenten).
 */
export function bouwHtml({ artikelen, frequentie, appUrl, naam, afmeldLink }: BouwOpties): string {
  const periode = frequentie === "maandelijks" ? "deze maand" : "deze week";
  const blokken = artikelen
    .map((a) => {
      const url = `${appUrl}/artikelen/${encodeURIComponent(a.slug)}`;
      const badge =
        a.toegang === "pro"
          ? `<span style="display:inline-block;padding:2px 9px;border-radius:9px;background:#1d1d1f;color:#fff;font-size:11px;font-weight:600">Pro</span>`
          : `<span style="display:inline-block;padding:2px 9px;border-radius:9px;background:rgba(36,138,61,0.14);color:#248a3d;font-size:11px;font-weight:600">Gratis</span>`;
      return `
      <tr><td style="padding:0 0 18px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:18px">
          <tr><td style="padding:22px 24px">
            ${badge}
            <h2 style="margin:10px 0 6px;font-size:19px;line-height:1.3;color:#1d1d1f">${escapeHtml(a.titel)}</h2>
            <p style="margin:0 0 14px;font-size:15px;line-height:1.55;color:#585249">${escapeHtml(a.samenvatting)}</p>
            <a href="${url}" style="font-size:14px;font-weight:600;color:#1d1d1f">Lees meer in de Community →</a>
          </td></tr>
        </table>
      </td></tr>`;
    })
    .join("");

  return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#cfc6bc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1d1d1f">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#cfc6bc">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;margin:0 auto">
        <tr><td style="padding:0 4px 24px">
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:#3b2e24">LuzeX Community</p>
          <h1 style="margin:0 0 10px;font-size:26px;line-height:1.2">Hoi ${escapeHtml(naam)},</h1>
          <p style="margin:0;font-size:16px;line-height:1.55;color:#585249">Dit is er ${periode} nieuw in zorginnovatie. Kort, praktisch en zonder jargon.</p>
        </td></tr>
        ${blokken}
        <tr><td align="center" style="padding:10px 0 28px">
          <a href="${appUrl}/artikelen.html" style="display:inline-block;padding:13px 26px;border-radius:980px;background:#1d1d1f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Lees meer in de Community</a>
        </td></tr>
        <tr><td style="padding:0 4px;font-size:12px;line-height:1.5;color:#6e6760">
          Je ontvangt deze mail omdat je lid bent van de LuzeX Community.
          <a href="${afmeldLink}" style="color:#6e6760">Afmelden voor de nieuwsbrief</a>.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/** Platte-tekstversie: meegestuurd naast de HTML, voor mailprogramma's zonder HTML en tegen spamfilters. */
export function bouwTekst({ artikelen, frequentie, appUrl, naam, afmeldLink }: BouwOpties): string {
  const periode = frequentie === "maandelijks" ? "deze maand" : "deze week";
  const blokken = artikelen
    .map(
      (a) =>
        `${a.toegang === "pro" ? "[Pro] " : ""}${a.titel}\n${a.samenvatting}\nLees meer: ${appUrl}/artikelen/${encodeURIComponent(a.slug)}`,
    )
    .join("\n\n");
  return `Hoi ${naam},\n\nDit is er ${periode} nieuw in zorginnovatie:\n\n${blokken}\n\nLees meer in de Community: ${appUrl}/artikelen.html\n\n--\nAfmelden voor de nieuwsbrief: ${afmeldLink}`;
}
