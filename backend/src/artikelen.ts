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

export function renderMarkdown(markdown: string): string {
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
 * - Gratis: iedereen, ook zonder account.
 * - Pro: alleen leden met een Pro-abonnement, en de admin.
 */
export function magVolledigLezen(
  toegang: string,
  bezoeker: { rol: SessionPayload["rol"]; abonnement: string } | null,
): boolean {
  if (toegang !== "pro") return true;
  if (!bezoeker) return false;
  return bezoeker.rol === "admin" || bezoeker.abonnement === "pro";
}

/** Waarom iemand een Pro-artikel niet kan lezen — de frontend kiest daarop de juiste tekst. */
export function vergrendelReden(
  bezoeker: { rol: SessionPayload["rol"]; abonnement: string } | null,
): "inloggen" | "pro_nodig" {
  return bezoeker ? "pro_nodig" : "inloggen";
}
