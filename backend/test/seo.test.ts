import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.env.APP_URL ??= "http://community.test";

const { artikelPagina, artikelenPagina, sitemapXml } = await import("../src/seo.js");

const FRONTEND = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "frontend");

const ARTIKEL = {
  titel: 'Agenda & AVG: wat mag je "delen"?',
  slug: "agenda-en-avg",
  samenvatting: "Een korte uitleg over wat je wel en niet mag delen.",
  toegang: "pro",
  categorie: "Wet & regelgeving",
  auteurNaam: "Job Faber",
  gepubliceerdOp: new Date("2026-10-01T09:00:00Z"),
  coverMime: "image/png",
};

/** Genoeg van PrismaClient om seo.ts te voeden, zonder database. */
function nepPrisma(rijen: unknown[]) {
  return {
    artikel: {
      findFirst: async () => rijen[0] ?? null,
      findMany: async () => rijen,
    },
  } as never;
}

test("artikelpagina zet titel, samenvatting en canonical in de HTML", async () => {
  const html = (await artikelPagina(nepPrisma([ARTIKEL]), FRONTEND, "agenda-en-avg")) as string;
  assert.ok(html.includes("<title>Agenda &amp; AVG: wat mag je &quot;delen&quot;? — LuzeX CMMNTY</title>"));
  assert.match(html, /<link rel="canonical" href="http:\/\/community\.test\/artikelen\/agenda-en-avg"/);
  assert.match(html, /<meta property="og:url" content="http:\/\/community\.test\/artikelen\/agenda-en-avg"/);
  assert.match(html, /<meta property="og:type" content="article"/);
  assert.ok(html.includes("Een korte uitleg over wat je wel en niet mag delen."));
});

test("artikelpagina geeft de tekst zelf nooit mee", async () => {
  // inhoud staat niet eens in de select van seo.ts; deze test bewaakt dat dat zo blijft.
  const metInhoud = { ...ARTIKEL, inhoud: "GEHEIME-ARTIKELTEKST" };
  const html = (await artikelPagina(nepPrisma([metInhoud]), FRONTEND, "agenda-en-avg")) as string;
  assert.ok(!html.includes("GEHEIME-ARTIKELTEKST"));
});

test("artikelpagina markeert de afscherming voor Google", async () => {
  const html = (await artikelPagina(nepPrisma([ARTIKEL]), FRONTEND, "agenda-en-avg")) as string;
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(\{"@context":"https:\/\/schema\.org","@type":"Article".*?)<\/script>/s)![1]);
  assert.equal(ld["@type"], "Article");
  assert.equal(ld.isAccessibleForFree, "False");
  assert.equal(ld.hasPart.isAccessibleForFree, "False");
  assert.equal(ld.headline, ARTIKEL.titel);
});

test("artikelpagina ontsnapt HTML in de titel", async () => {
  const stout = { ...ARTIKEL, titel: '<img src=x onerror="alert(1)">', samenvatting: "</script><b>x</b>" };
  const html = (await artikelPagina(nepPrisma([stout]), FRONTEND, "agenda-en-avg")) as string;
  assert.ok(!html.includes("<img src=x"));
  assert.ok(!html.includes("</script><b>"));
  assert.ok(html.includes("&lt;img src=x"));
});

test("onbekende slug geeft null, zodat de route 404 kan sturen", async () => {
  assert.equal(await artikelPagina(nepPrisma([]), FRONTEND, "bestaat-niet"), null);
});

test("lijstpagina zet elk artikel als link in de HTML", async () => {
  const html = await artikelenPagina(nepPrisma([ARTIKEL, { ...ARTIKEL, slug: "tweede", titel: "Tweede" }]), FRONTEND);
  assert.match(html, /<a href="\/artikelen\/agenda-en-avg">/);
  assert.match(html, /<a href="\/artikelen\/tweede">/);
  assert.ok(html.includes("Tweede"));
  assert.ok(!html.includes("Artikelen laden…"), "de laadtekst hoort vervangen te zijn");
});

test("lege lijst breekt niet", async () => {
  const html = await artikelenPagina(nepPrisma([]), FRONTEND);
  assert.ok(html.includes("Er zijn nog geen artikelen."));
});

test("sitemap bevat de vaste pagina's en elk artikel", async () => {
  const xml = await sitemapXml(nepPrisma([ARTIKEL]));
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>'));
  assert.ok(xml.includes("<loc>http://community.test/</loc>"));
  assert.ok(xml.includes("<loc>http://community.test/artikelen.html</loc>"));
  assert.ok(xml.includes("<loc>http://community.test/netwerk.html</loc>"));
  assert.ok(xml.includes("<loc>http://community.test/artikelen/agenda-en-avg</loc>"));
  assert.ok(xml.includes("<lastmod>2026-10-01</lastmod>"));
});
