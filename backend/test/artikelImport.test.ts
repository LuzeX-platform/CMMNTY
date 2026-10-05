import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bronnenSectie, leesArtikelBestand } from "../src/artikelImport.js";
import { CATEGORIEEN } from "../src/constanten.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CONTENT = path.join(__dirname, "..", "..", "content", "artikelen");

const voorbeeld = `---
titel: "Een titel: met dubbele punt"
slug: een-titel
samenvatting: "Kort."
categorie: Behandelen
tags: [a, b]
bronnen:
  - titel: "Bron één"
    url: https://example.nl/een
---

Tekst met ë en “aanhalingstekens”.
`;

test("leesArtikelBestand: velden, standaardwaarden en bronnen onderaan", () => {
  const a = leesArtikelBestand(voorbeeld, "test.md");
  assert.equal(a.titel, "Een titel: met dubbele punt");
  assert.equal(a.slug, "een-titel");
  assert.equal(a.toegang, "gratis");
  assert.equal(a.auteurNaam, "Job");
  assert.equal(a.categorie, "Behandelen");
  assert.match(a.inhoud, /^Tekst met ë en “aanhalingstekens”\.\n\n## Bronnen\n\n- \[Bron één\]\(https:\/\/example\.nl\/een\)\n$/);
});

test("leesArtikelBestand: weigert ontbrekende velden, foute slug en foute toegang", () => {
  assert.throws(() => leesArtikelBestand("geen frontmatter", "x.md"), /frontmatter/);
  assert.throws(() => leesArtikelBestand(voorbeeld.replace("slug: een-titel", "slug: Een Titel"), "x.md"), /slug/);
  assert.throws(() => leesArtikelBestand(voorbeeld.replace('titel: "Een titel: met dubbele punt"\n', ""), "x.md"), /titel/);
  assert.throws(() => leesArtikelBestand(voorbeeld.replace("categorie:", "toegang: betaald\ncategorie:"), "x.md"), /toegang/);
});

test("bronnenSectie: leeg zonder bronnen", () => {
  assert.equal(bronnenSectie([]), "");
});

test("alle artikelbestanden in content/ zijn geldig en hebben een bekende categorie", () => {
  const bestanden = fs.readdirSync(CONTENT, { recursive: true }).map(String).filter((f) => f.endsWith(".md"));
  assert.ok(bestanden.length >= 6);
  const slugs = new Set<string>();
  for (const bestand of bestanden) {
    const a = leesArtikelBestand(fs.readFileSync(path.join(CONTENT, bestand), "utf8"), bestand);
    assert.ok(!slugs.has(a.slug), `dubbele slug ${a.slug}`);
    slugs.add(a.slug);
    assert.ok(a.categorie && (CATEGORIEEN as readonly string[]).includes(a.categorie), `${bestand}: onbekende categorie ${a.categorie}`);
    assert.match(a.inhoud, /## Bronnen\n\n- \[/);
  }
});
