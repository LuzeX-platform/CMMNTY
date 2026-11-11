// Artikelen leesbaar maken voor zoekmachines en linkvoorbeelden.
//
// Het probleem: artikelen.html en artikel.html zijn lege schillen. De lijst en
// het artikel worden pas in de browser opgehaald uit /api/artikelen. Een
// zoekmachine die geen JavaScript draait — en dat geldt voor de
// linkvoorbeelden van WhatsApp, LinkedIn, Slack en iMessage, en voor de meeste
// AI-crawlers — ziet dus een lege pagina. Google rendert wel, maar vertraagd en
// niet gegarandeerd, en dat is een slechte basis voor de inhoud waar deze site
// om draait.
//
// De oplossing: dezelfde etalage die /api/artikelen/:slug al teruggeeft aan wie
// niet is ingelogd (titel, samenvatting, metadata, nooit de tekst) wordt hier
// in de HTML gezet voordat die de deur uit gaat. De paginascripts vervangen die
// inhoud daarna met innerHTML, dus iemand met JavaScript ziet hem nooit.
//
// Dit is geen cloaking: de server toont precies wat een uitgelogde bezoeker
// ook te zien krijgt. Dat de volledige tekst een account vereist, staat
// expliciet in de structuurgegevens (isAccessibleForFree), wat de route is die
// Google voor afgeschermde inhoud voorschrijft.
import fs from "node:fs/promises";
import path from "node:path";
import type { PrismaClient } from "@prisma/client";
import { appUrl } from "./nieuwsbriefVersturen.js";

export function escapeHtml(t: string): string {
  return t
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// JSON in een <script> mag nooit </script> kunnen bevatten, anders sluit de tag
// voortijdig en staat de rest van de pagina als tekst in beeld.
function jsonLd(data: unknown): string {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

/** Vervangt een meta/link-waarde als de tag er staat; doet niets als hij ontbreekt. */
function zetAttribuut(html: string, zoek: RegExp, waarde: string): string {
  return html.replace(zoek, (hele) => hele.replace(/content="[^"]*"|href="[^"]*"/, (deel) =>
    deel.startsWith("href") ? `href="${escapeHtml(waarde)}"` : `content="${escapeHtml(waarde)}"`));
}

function zetKop(html: string, titel: string, oms: string, url: string, extra = ""): string {
  let uit = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(titel)}</title>`);
  uit = zetAttribuut(uit, /<meta name="description"[^>]*>/, oms);
  uit = zetAttribuut(uit, /<link rel="canonical"[^>]*>/, url);
  uit = zetAttribuut(uit, /<meta property="og:title"[^>]*>/, titel);
  uit = zetAttribuut(uit, /<meta property="og:description"[^>]*>/, oms);
  uit = zetAttribuut(uit, /<meta property="og:url"[^>]*>/, url);
  uit = zetAttribuut(uit, /<meta name="twitter:title"[^>]*>/, titel);
  uit = zetAttribuut(uit, /<meta name="twitter:description"[^>]*>/, oms);
  return extra ? uit.replace("</head>", `  ${extra}\n</head>`) : uit;
}

/** Zet inhoud in een leeg element, bijv. <div id="artikel"></div>. */
function vulElement(html: string, id: string, inhoud: string): string {
  const open = new RegExp(`(<(?:div|article|section)[^>]*\\bid="${id}"[^>]*>)([\\s\\S]*?)(</(?:div|article|section)>)`);
  return html.replace(open, (_h, a, _oud, z) => `${a}${inhoud}${z}`);
}

async function schil(frontend: string, bestand: string): Promise<string> {
  return fs.readFile(path.join(frontend, bestand), "utf8");
}

function datumNl(d: Date | null): string {
  if (!d) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

/** Eén artikel: titel, samenvatting en metadata. Nooit de tekst zelf. */
export async function artikelPagina(
  prisma: PrismaClient,
  frontend: string,
  slug: string,
): Promise<string | null> {
  const a = await prisma.artikel.findFirst({
    where: { slug, gepubliceerdOp: { not: null, lte: new Date() } },
    select: {
      titel: true, slug: true, samenvatting: true, toegang: true,
      categorie: true, auteurNaam: true, gepubliceerdOp: true, coverMime: true,
    },
  });
  if (!a) return null;

  const basis = appUrl();
  const url = `${basis}/artikelen/${encodeURIComponent(a.slug)}`;
  const titel = `${a.titel} — LuzeX CMMNTY`;

  // Beide niveaus vragen een account, ook "gratis". Dat zo opschrijven is
  // eerlijker dan doen alsof gratis artikelen open staan.
  const ld = jsonLd({
    "@context": "https://schema.org",
    "@type": "Article",
    headline: a.titel,
    description: a.samenvatting,
    url,
    mainEntityOfPage: url,
    ...(a.categorie ? { articleSection: a.categorie } : {}),
    ...(a.auteurNaam ? { author: { "@type": "Person", name: a.auteurNaam } } : {}),
    ...(a.gepubliceerdOp ? { datePublished: a.gepubliceerdOp.toISOString() } : {}),
    ...(a.coverMime ? { image: `${basis}/api/artikelen/${encodeURIComponent(a.slug)}/cover` } : {}),
    publisher: { "@type": "Organization", name: "LuzeX", url: "https://luzex.nl/" },
    isAccessibleForFree: "False",
    hasPart: {
      "@type": "WebPageElement",
      isAccessibleForFree: "False",
      cssSelector: ".artikel-inhoud",
    },
  });

  let html = zetKop(await schil(frontend, "artikel.html"), titel, a.samenvatting, url, ld);
  html = html.replace(/<meta property="og:type" content="[^"]*"/, '<meta property="og:type" content="article"');

  const meta = [
    a.categorie ? escapeHtml(a.categorie) : "",
    a.auteurNaam ? escapeHtml(a.auteurNaam) : "",
    datumNl(a.gepubliceerdOp),
    a.toegang === "pro" ? "Pro" : "Gratis met account",
  ].filter(Boolean).join(" &middot; ");

  return vulElement(html, "artikel", `
      <header class="artikel-kop">
        <h1>${escapeHtml(a.titel)}</h1>
        <p class="artikel-meta">${meta}</p>
      </header>
      <p class="artikel-samenvatting">${escapeHtml(a.samenvatting)}</p>
      <p><a href="/inloggen.html">Log in om het hele artikel te lezen</a> of
         <a href="/registreren.html">maak een gratis account</a>.</p>`);
}

/** De lijst: titel en samenvatting per artikel, met een link naar het artikel. */
export async function artikelenPagina(prisma: PrismaClient, frontend: string): Promise<string> {
  const rijen = await prisma.artikel.findMany({
    where: { gepubliceerdOp: { not: null, lte: new Date() } },
    orderBy: { gepubliceerdOp: "desc" },
    take: 50,
    select: { titel: true, slug: true, samenvatting: true, categorie: true, gepubliceerdOp: true },
  });

  const basis = appUrl();
  const html = await schil(frontend, "artikelen.html");

  const items = rijen.map((a) => `
        <article class="kaart">
          <h2><a href="/artikelen/${encodeURIComponent(a.slug)}">${escapeHtml(a.titel)}</a></h2>
          <p>${escapeHtml(a.samenvatting)}</p>
          ${a.categorie ? `<p class="kaart-meta">${escapeHtml(a.categorie)} &middot; ${datumNl(a.gepubliceerdOp)}</p>` : ""}
        </article>`).join("");

  const ld = jsonLd({
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: rijen.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${basis}/artikelen/${encodeURIComponent(a.slug)}`,
      name: a.titel,
    })),
  });

  return vulElement(html.replace("</head>", `  ${ld}\n</head>`), "artikelen",
    items || '<p class="leeg">Er zijn nog geen artikelen.</p>');
}

/** Sitemap uit de database, zodat een nieuw artikel vanzelf vindbaar wordt. */
export async function sitemapXml(prisma: PrismaClient): Promise<string> {
  const basis = appUrl();
  const rijen = await prisma.artikel.findMany({
    where: { gepubliceerdOp: { not: null, lte: new Date() } },
    orderBy: { gepubliceerdOp: "desc" },
    select: { slug: true, gepubliceerdOp: true },
  });

  const vast = [
    { loc: `${basis}/`, prio: "1.0", freq: "weekly" },
    { loc: `${basis}/artikelen.html`, prio: "0.9", freq: "weekly" },
    { loc: `${basis}/netwerk.html`, prio: "0.8", freq: "weekly" },
  ];

  const regels = [
    ...vast.map((u) =>
      `  <url>\n    <loc>${escapeHtml(u.loc)}</loc>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.prio}</priority>\n  </url>`),
    ...rijen.map((a) =>
      `  <url>\n    <loc>${escapeHtml(`${basis}/artikelen/${encodeURIComponent(a.slug)}`)}</loc>` +
      (a.gepubliceerdOp ? `\n    <lastmod>${a.gepubliceerdOp.toISOString().slice(0, 10)}</lastmod>` : "") +
      `\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`),
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${regels.join("\n")}\n</urlset>\n`;
}
