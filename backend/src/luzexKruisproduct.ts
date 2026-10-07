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
 * trekken, zonder zelf iets te veranderen bij ACCRD. */
export async function controleerKruisproductStatus(kvkNummer: string): Promise<boolean> {
  const config = basisUrlEnSleutel();
  if (!config) return false;
  try {
    const response = await fetch(
      `${config.basisUrl}/api/intern/luzex-kruisproduct-status?kvkNummer=${encodeURIComponent(kvkNummer)}&product=${PRODUCT}`,
      { headers: { "X-Luzex-Intern-Sleutel": config.sleutel }, signal: AbortSignal.timeout(5000) },
    );
    if (!response.ok) return false;
    const data = (await response.json()) as { actief?: boolean };
    return data.actief === true;
  } catch {
    return false;
  }
}

/** Schrijvend: aangeroepen op het moment dat de klant zelf zijn kvk-nummer invult. `wisselen`
 * bevestigt expliciet dat een al bestaande keuze voor RSLNT mag omzetten naar CMMNTY — zonder
 * die vlag wijst ACCRD dat af ("al_gekozen") in plaats van het stilletjes te overschrijven. */
export async function claimKruisproductPro(kvkNummer: string, wisselen?: boolean): Promise<ClaimStatus> {
  const config = basisUrlEnSleutel();
  if (!config) return { status: "onbereikbaar" };
  try {
    const response = await fetch(`${config.basisUrl}/api/intern/luzex-kruisproduct-claim`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Luzex-Intern-Sleutel": config.sleutel },
      body: JSON.stringify({ kvkNummer, product: PRODUCT, wisselen }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { status: "onbereikbaar" };
    return (await response.json()) as ClaimStatus;
  } catch {
    return { status: "onbereikbaar" };
  }
}
