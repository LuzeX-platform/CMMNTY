import { test } from "node:test";
import assert from "node:assert/strict";
import { leestijdMinuten, maakSlug, magVolledigLezen, publicatieVolgorde, renderMarkdown, vergrendelReden } from "../src/artikelen.js";

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

test("magVolledigLezen: gratis voor iedereen, Pro alleen voor Pro-leden en admin", () => {
  assert.equal(magVolledigLezen("gratis", null), true);
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
