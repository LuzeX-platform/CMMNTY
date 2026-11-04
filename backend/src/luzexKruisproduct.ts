// Kruisproduct-Pro v2: een actief, betalend ACCRD-account geeft gratis Pro op CMMNTY, op basis
// van kvk-nummer in plaats van e-mailadres. Zie hub/CLAUDE.md, "Kruisproduct-Pro", en
// ACCRD's platform/backend/src/routes/luzexIntern.ts voor de volledige afspraak.
//
// Vervangt het oudere, e-mailgebaseerde mechanisme (het vorige luzexEntitlement.ts) volledig:
// SCRNN speelt hier bewust geen rol in — alleen ACCRD is bron voor CMMNTY/RSLNT — en de klant
// vult zijn kvk-nummer zelf in, in plaats van dat we e-mailadressen laten matchen. Wie al
// gratis Pro had via het oude mechanisme verliest die bij de eerstvolgende cron-run (geen
// kvk-nummer op het nieuwe record) en moet opnieuw claimen; dat is een bewuste keuze, geen bug.
//
// Elk product blijft volledig op zichzelf: dit roept alleen ACCRD's eigen
// /api/intern/luzex-kruisproduct-status (lezen) en -claim (schrijven) aan, met een gedeeld
// geheim in plaats van een gewone sessie. Is ACCRD niet bereikbaar of niet geconfigureerd, dan
// telt dat simpelweg als "niet actief" — dit mag een claim-poging of de cron nooit laten
// vastlopen met een onverwerkte fout.

const PRODUCT = "cmmnty";

type ClaimStatus =
  | { status: "toegekend" }
  | { status: "niet_actief" }
  | { status: "al_gekozen"; huidigeKeuze: "cmmnty" | "rslnt" }
  | { status: "onbereikbaar" };

function basisUrlEnSleutel(): { basisUrl: string; sleutel: string } | null {
  const basisUrl = process.env.ACCRD_INTERN_URL;
  const sleutel = process.env.LUZEX_INTERN_SLEUTEL;
  if (!basisUrl || !sleutel) return null;
  return { basisUrl: basisUrl.replace(/\/+$/, ""), sleutel };
}

/** Alleen lezen: is dit kvk-nummer nog steeds actief gekoppeld aan CMMNTY bij ACCRD? Gebruikt
 * door de dagelijkse cron om een eerder toegekende Pro-status opnieuw te bevestigen of in te
 * trekken, zonder zelf iets te veranderen bij ACCRD.
 *
 * `null` betekent "kon niet gecontroleerd worden" (geen config, netwerkfout, ACCRD plat) en is
 * iets anders dan een bevestigd "nee". Dit gaf eerst `false` terug, en dan trok de cron bij elke
 * storing bij ACCRD (of een vergeten env-var) in één klap ieders gratis Pro in én wiste hij hun
 * kvk-nummer, zodat ze opnieuw moesten claimen. RSLNT had dit al zo; nu ook CMMNTY. */
export async function controleerKruisproductStatus(kvkNummer: string): Promise<boolean | null> {
  const config = basisUrlEnSleutel();
  if (!config) return null;
  try {
    const response = await fetch(
      `${config.basisUrl}/api/intern/luzex-kruisproduct-status?kvkNummer=${encodeURIComponent(kvkNummer)}&product=${PRODUCT}`,
      { headers: { "X-Luzex-Intern-Sleutel": config.sleutel }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return null;
    const data = (await response.json()) as { actief?: unknown };
    return typeof data.actief === "boolean" ? data.actief : null;
  } catch {
    return null;
  }
}

/** Schrijvend: aangeroepen op het moment dat de klant zelf zijn kvk-nummer invult. `wisselen`
 * bevestigt expliciet dat een al bestaande keuze voor RSLNT mag omzetten naar CMMNTY — zonder
 * die vlag wijst ACCRD dat af ("al_gekozen") in plaats van het stilletjes te overschrijven. */
export async function claimKruisproductPro(kvkNummer: string, code: string, wisselen?: boolean): Promise<ClaimStatus> {
  const config = basisUrlEnSleutel();
  if (!config) return { status: "onbereikbaar" };
  try {
    const response = await fetch(`${config.basisUrl}/api/intern/luzex-kruisproduct-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Luzex-Intern-Sleutel": config.sleutel },
      // De koppelcode uit ACCRD: het KvK-nummer alleen is openbaar (zie kruisproductCode.ts in ACCRD).
      body: JSON.stringify({ kvkNummer, code, product: PRODUCT, wisselen }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: "onbereikbaar" };
    return (await response.json()) as ClaimStatus;
  } catch {
    return { status: "onbereikbaar" };
  }
}

/**
 * Een KvK-nummer zoals de klant het typt ("1234 5678", "12.34.56.78") terug naar de vorm waarin
 * ACCRD het bewaart: acht cijfers, of bij een buitenlands Tax-ID letters, cijfers en streepjes.
 * ACCRD herkent de varianten zelf ook (kvkVarianten() in luzexIntern.ts), maar hier opgeschoond
 * bewaren houdt kruisproductKvkNummer uniek per bedrijf, wat de klant er ook van maakte.
 */
export function schoonKvkNummer(invoer: string): string {
  const zonderSpatiesEnPunten = invoer.trim().replace(/[\s.]/g, "");
  const alleenCijfers = zonderSpatiesEnPunten.replace(/\D/g, "");
  return /^\d{8}$/.test(alleenCijfers) && /^[\d-]+$/.test(zonderSpatiesEnPunten) ? alleenCijfers : zonderSpatiesEnPunten;
}

// --- "Koppel met ACCRD" ---------------------------------------------------------------------
// De knop in plaats van KvK-nummer en koppelcode overtypen (zie ACCRD's
// routes/kruisproductKoppelen.ts). De klant geeft in ACCRD toestemming; ACCRD stuurt hem met een
// eenmalig token terug, en dat token wisselen we hier server-naar-server in. De state bindt het
// token aan de browsersessie waarin de koppeling begon: zonder die controle kan iemand een eigen
// token in andermans sessie laten inwisselen.

type InwisselStatus =
  | { status: "toegekend"; kvkNummer: string }
  | { status: "niet_actief" }
  | { status: "ongeldig" }
  | { status: "al_gekozen"; huidigeKeuze: "cmmnty" | "rslnt" }
  | { status: "onbereikbaar" };

/** Waar de knop naartoe gaat, of null als ACCRD hier niet ingesteld is (dan geen knop). Zelfde
 *  ACCRD_INTERN_URL als de server-naar-server-aanroepen: in productie is dat het publieke
 *  adres van ACCRD, dus een tweede variabele zou alleen een kans op verschil toevoegen. */
export function accrdKoppelUrl(state: string): string | null {
  const config = basisUrlEnSleutel();
  if (!config) return null;
  return `${config.basisUrl}/kruisproduct-koppelen.html?product=${PRODUCT}&state=${encodeURIComponent(state)}`;
}

export async function wisselKoppeltokenIn(token: string, state: string): Promise<InwisselStatus> {
  const config = basisUrlEnSleutel();
  if (!config) return { status: "onbereikbaar" };
  try {
    const response = await fetch(`${config.basisUrl}/api/intern/luzex-kruisproduct-inwisselen`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Luzex-Intern-Sleutel": config.sleutel },
      body: JSON.stringify({ token, state, product: PRODUCT }),
      signal: AbortSignal.timeout(5000),
    });
    if (response.status === 400) return { status: "ongeldig" };
    if (!response.ok) return { status: "onbereikbaar" };
    return (await response.json()) as InwisselStatus;
  } catch {
    return { status: "onbereikbaar" };
  }
}
