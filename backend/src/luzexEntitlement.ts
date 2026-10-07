// Kruisproduct-Pro: een actief, betalend account bij ACCRD of SCRNN geeft gratis Pro op CMMNTY
// (en op RSLNT, die dit bestand 1-op-1 heeft). Zie hub/CLAUDE.md, "Kruisproduct-Pro", voor de
// volledige afspraak en waarom dit zo is opgezet.
//
// Elk product blijft volledig op zichzelf: dit roept alleen het andere product diens eigen
// /api/intern/luzex-klant-status aan (een ja/nee-antwoord, geen data), met een gedeeld geheim
// in plaats van een gewone sessie. Is een van de twee niet bereikbaar of niet geconfigureerd,
// dan telt die simpelweg niet mee — dit mag een registratie of de cron nooit laten vastlopen.

type Bron = "accrd" | "scrnn";

async function isActieveKlant(basisUrl: string | undefined, email: string): Promise<boolean> {
  const sleutel = process.env.LUZEX_INTERN_SLEUTEL;
  if (!basisUrl || !sleutel) return false;
  try {
    const response = await fetch(`${basisUrl.replace(/\/+$/, "")}/api/intern/luzex-klant-status?email=${encodeURIComponent(email)}`, {
      headers: { "X-Luzex-Intern-Sleutel": sleutel },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const data = (await response.json()) as { actief?: boolean };
    return data.actief === true;
  } catch {
    return false;
  }
}

/** ACCRD eerst, dan SCRNN — de eerste die "ja" zegt wint. Geeft null als geen van beide actief is. */
export async function controleerKruisproductPro(email: string): Promise<Bron | null> {
  if (await isActieveKlant(process.env.ACCRD_INTERN_URL, email)) return "accrd";
  if (await isActieveKlant(process.env.SCRNN_INTERN_URL, email)) return "scrnn";
  return null;
}
