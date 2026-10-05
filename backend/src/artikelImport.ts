import { parse as parseYaml } from "yaml";
import { maakSlug } from "./artikelen.js";

// Pure logica van het importscript (importeerArtikelen.ts): een Markdown-bestand met
// frontmatter omzetten naar artikelvelden. Geen database hier, zodat dit los te testen is
// (test/artikelImport.test.ts).

export interface Bron {
  titel: string;
  url: string;
}

export interface GeimporteerdArtikel {
  titel: string;
  slug: string;
  samenvatting: string;
  /** Markdown, met de bronnen als laatste sectie "## Bronnen". */
  inhoud: string;
  toegang: "gratis" | "pro";
  categorie: string | null;
  auteurNaam: string;
}

/**
 * Frontmatter-velden die het datamodel (nog) niet kent en die daarom bewust niet in de
 * database komen. Ze blijven wel in de bestanden staan, zodat ze later alsnog te gebruiken zijn.
 */
export const GENEGEERDE_VELDEN = ["status", "tags", "reeks", "volgorde", "gecontroleerd_op"];

const FRONTMATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

function tekstVeld(data: Record<string, unknown>, sleutel: string, bestand: string): string {
  const waarde = data[sleutel];
  if (typeof waarde !== "string" || !waarde.trim()) {
    throw new Error(`${bestand}: veld "${sleutel}" ontbreekt of is leeg`);
  }
  return waarde.trim();
}

/** Bronnen als klikbare lijst onder een eigen kopje — er is (nog) geen apart bronnenveld. */
export function bronnenSectie(bronnen: Bron[]): string {
  if (bronnen.length === 0) return "";
  // [ en ] in een titel zouden de Markdown-link breken.
  const regels = bronnen.map((b) => `- [${b.titel.replace(/[[\]]/g, "")}](${b.url})`);
  return `## Bronnen\n\n${regels.join("\n")}`;
}

export function leesArtikelBestand(tekst: string, bestand: string): GeimporteerdArtikel {
  const match = FRONTMATTER.exec(tekst);
  if (!match) throw new Error(`${bestand}: geen frontmatter (--- … ---) bovenaan gevonden`);

  const data = (parseYaml(match[1]) ?? {}) as Record<string, unknown>;
  const body = match[2].trim();
  if (!body) throw new Error(`${bestand}: de tekst van het artikel is leeg`);

  const slug = tekstVeld(data, "slug", bestand);
  if (maakSlug(slug) !== slug) {
    throw new Error(`${bestand}: slug "${slug}" mag alleen kleine letters, cijfers en streepjes bevatten`);
  }

  const toegang = data.toegang ?? "gratis";
  if (toegang !== "gratis" && toegang !== "pro") {
    throw new Error(`${bestand}: toegang moet "gratis" of "pro" zijn, niet "${String(toegang)}"`);
  }

  const ruweBronnen = data.bronnen ?? [];
  if (!Array.isArray(ruweBronnen)) throw new Error(`${bestand}: "bronnen" moet een lijst zijn`);
  const bronnen = ruweBronnen.map((b, i) => {
    const bron = b as Partial<Bron>;
    if (typeof bron?.titel !== "string" || typeof bron?.url !== "string" || !/^https?:\/\//.test(bron.url)) {
      throw new Error(`${bestand}: bron ${i + 1} heeft geen geldige titel en url`);
    }
    return { titel: bron.titel.trim(), url: bron.url.trim() };
  });

  const categorie = typeof data.categorie === "string" && data.categorie.trim() ? data.categorie.trim() : null;
  const auteurNaam = typeof data.auteur === "string" && data.auteur.trim() ? data.auteur.trim() : "Job";

  return {
    titel: tekstVeld(data, "titel", bestand),
    slug,
    samenvatting: tekstVeld(data, "samenvatting", bestand),
    inhoud: [body, bronnenSectie(bronnen)].filter(Boolean).join("\n\n") + "\n",
    toegang,
    categorie,
    auteurNaam,
  };
}
