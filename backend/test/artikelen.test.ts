import { test } from "node:test";
import assert from "node:assert/strict";
import { coverPad, leestijdMinuten, zetBlokken, maakSlug, magVolledigLezen, publicatieVolgorde, renderMarkdown, vergrendelReden } from "../src/artikelen.js";

test("maakSlug: leesbaar, zonder accenten en leestekens", () => {
  assert.equal(maakSlug("Hoe AI je administratie 2 uur per week kan besparen"), "hoe-ai-je-administratie-2-uur-per-week-kan-besparen");
  assert.equal(maakSlug("Privacy & AVG: één checklist!"), "privacy-en-avg-een-checklist");
  assert.equal(maakSlug("  --  "), "");
  assert.ok(maakSlug("a".repeat(200)).length <= 80);
});

test("leestijdMinuten: 200 woorden per minuut, minimaal 1", () => {
  assert.equal(leestijdMinuten("kort"), 1);
  assert.equal(leestijdMinuten(Array(1000).fill("woord").join(" ")), 5);
});

test("renderMarkdown: zet Markdown om en haalt gevaarlijke HTML weg", () => {
  const html = renderMarkdown("## Kop\n\n**vet** en [link](https://luzex.nl)\n\n<script>alert(1)</script><img src=x onerror=alert(1)>");
  assert.match(html, /<h2>Kop<\/h2>/);
  assert.match(html, /<strong>vet<\/strong>/);
  assert.match(html, /target="_blank"/);
  assert.doesNotMatch(html, /<script/);
  assert.doesNotMatch(html, /onerror/);
});

test("renderMarkdown: h1 wordt h2 en javascript:-links verdwijnen", () => {
  const html = renderMarkdown("# Titel\n\n[klik](javascript:alert(1))");
  assert.match(html, /<h2>Titel<\/h2>/);
  assert.doesNotMatch(html, /javascript:/);
});

test("magVolledigLezen: gratis voor elk lid, Pro alleen voor Pro-leden en admin, niets zonder account", () => {
  assert.equal(magVolledigLezen("gratis", null), false);
  assert.equal(magVolledigLezen("gratis", { rol: "lid", abonnement: "gratis" }), true);
  assert.equal(magVolledigLezen("pro", null), false);
  assert.equal(magVolledigLezen("pro", { rol: "lid", abonnement: "gratis" }), false);
  assert.equal(magVolledigLezen("pro", { rol: "lid", abonnement: "pro" }), true);
  assert.equal(magVolledigLezen("pro", { rol: "admin", abonnement: "gratis" }), true);
});

test("vergrendelReden: bezoeker moet inloggen, gratis lid heeft Pro nodig", () => {
  assert.equal(vergrendelReden(null), "inloggen");
  assert.equal(vergrendelReden({ rol: "lid", abonnement: "gratis" }), "pro_nodig");
});

test("publicatieVolgorde: nieuwste import bovenaan, binnen een import bestand 01 eerst", () => {
  const om = (id: string, iso: string) => ({ id, aangemaaktOp: new Date(iso) });
  const volgorde = publicatieVolgorde([
    om("week43-02", "2026-10-26T10:00:01Z"),
    om("week41-01", "2026-10-12T09:00:00Z"),
    om("week43-01", "2026-10-26T10:00:00Z"),
    om("week41-02", "2026-10-12T09:00:01Z"),
    om("los-artikel", "2026-10-20T15:00:00Z"),
  ]);
  assert.deepEqual(
    volgorde.map((a) => a.id),
    ["week43-01", "week43-02", "los-artikel", "week41-01", "week41-02"],
  );
  assert.deepEqual(publicatieVolgorde([]), []);
});

test("coverPad: versie in het adres als de wijzigingsdatum bekend is", () => {
  assert.equal(coverPad("a b"), "/api/artikelen/a%20b/cover");
  assert.equal(coverPad("x", new Date("2026-11-20T10:00:00Z")), `/api/artikelen/x/cover?v=${Date.parse("2026-11-20T10:00:00Z")}`);
});

test("vaste kopjes worden een eigen blok, de rest blijft zoals het is", () => {
  const html = renderMarkdown(
    "Intro.\n\n## Wat is er gebeurd?\n\nTekst.\n\n## Wat zegt het onderzoek níét?\n\n- a\n\n" +
      "## Wat betekent dit voor jou?\n\nJij.\n\n### Subkop\n\nNog meer.\n\n## Morgen al beginnen?\n\n- doe dit\n\n## Bronnen\n\n- [x](https://x.nl)",
  );
  assert.ok(html.includes("<h2>Wat is er gebeurd?</h2>"));
  assert.ok(!/<section[^>]*>\s*<h2>Wat is er gebeurd/.test(html), "gewone kopjes krijgen geen blok");
  assert.match(html, /<section class="blok blok-letop">\s*<h2>Wat zegt het onderzoek níét\?<\/h2>/);
  // Een h3 binnen de sectie blijft binnen hetzelfde blok.
  assert.match(html, /<section class="blok blok-jou">\s*<h2>Wat betekent dit voor jou\?<\/h2>[\s\S]*<h3>Subkop<\/h3>[\s\S]*?<\/section>\s*<section class="blok blok-actie">/);
  assert.match(html, /<section class="blok-bronnen">\s*<h2>Bronnen<\/h2>[\s\S]*<\/section>\s*$/);
  assert.equal((html.match(/<section/g) ?? []).length, (html.match(/<\/section>/g) ?? []).length);
});

test("In het kort: een citaat dat zo begint, wordt een samenvattingsblok", () => {
  const html = renderMarkdown("> **In het kort**\n>\n> - een\n> - twee\n\nTekst.\n\n> Gewoon citaat.");
  assert.match(html, /^<blockquote class="blok blok-kort">\s*<p class="blok-kicker">In het kort<\/p>\s*<ul>/);
  assert.match(html, /<blockquote>\s*<p>Gewoon citaat\.<\/p>/);
});

test("zetBlokken voegt alleen vaste opmaak toe: de tekst van het kopje komt nergens anders terecht", () => {
  const html = zetBlokken('<h2>Morgen al beginnen? &lt;script&gt;</h2><p>x</p>');
  assert.equal(html, '<section class="blok blok-actie">\n<h2>Morgen al beginnen? &lt;script&gt;</h2><p>x</p>\n</section>\n');
  // Ook na het opschonen kan een kopje geen script binnensmokkelen.
  assert.ok(!renderMarkdown("## Morgen al beginnen? <script>alert(1)</script>").includes("<script"));
});
