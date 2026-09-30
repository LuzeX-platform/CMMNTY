import { test } from "node:test";
import assert from "node:assert/strict";
import { artikelenVoorSegment, bouwHtml, bouwTekst, isVerzenddag, onderwerp, periodeStart } from "../src/nieuwsbrief.js";

test("isVerzenddag: wekelijks op maandag, maandelijks op de 1e, uit nooit", () => {
  const maandag = new Date("2026-10-05T08:00:00Z");
  const dinsdag = new Date("2026-10-06T08:00:00Z");
  const eersteVanDeMaand = new Date("2026-10-01T08:00:00Z"); // donderdag
  assert.equal(isVerzenddag("wekelijks", maandag), true);
  assert.equal(isVerzenddag("wekelijks", dinsdag), false);
  assert.equal(isVerzenddag("maandelijks", eersteVanDeMaand), true);
  assert.equal(isVerzenddag("maandelijks", maandag), false);
  assert.equal(isVerzenddag("uit", maandag), false);
});

test("periodeStart: vanaf de vorige verzending, anders één periode terug", () => {
  const nu = new Date("2026-10-05T08:00:00Z");
  const vorige = new Date("2026-09-28T08:00:00Z");
  assert.equal(periodeStart("wekelijks", nu, vorige).toISOString(), vorige.toISOString());
  assert.equal(periodeStart("wekelijks", nu, null).toISOString(), "2026-09-28T08:00:00.000Z");
  assert.equal(periodeStart("maandelijks", nu, null).toISOString(), "2026-09-05T08:00:00.000Z");
});

test("artikelenVoorSegment: gratis-leden krijgen alleen gratis, Pro alles", () => {
  const artikelen = [{ toegang: "gratis" }, { toegang: "pro" }, { toegang: "gratis" }];
  assert.equal(artikelenVoorSegment(artikelen, "gratis").length, 2);
  assert.equal(artikelenVoorSegment(artikelen, "pro").length, 3);
});

test("onderwerp: vriendelijk, niet salesy", () => {
  assert.equal(onderwerp("wekelijks", 1), "Deze week in zorgtech: 1 nieuw artikel");
  assert.equal(onderwerp("maandelijks", 3), "Deze maand in zorgtech: 3 nieuwe artikelen");
});

test("bouwHtml/bouwTekst: links naar artikelen, afmeldlink en ontsnapte titels", () => {
  const opties = {
    artikelen: [
      {
        id: "1",
        titel: "AI <script>",
        slug: "ai-en-jij",
        samenvatting: "Kort & krachtig",
        toegang: "pro",
        auteurNaam: "Job",
        gepubliceerdOp: new Date(),
      },
    ],
    frequentie: "wekelijks" as const,
    appUrl: "https://cmmnty.luzex.nl",
    naam: "Sanne",
    afmeldLink: "https://cmmnty.luzex.nl/afmelden.html?token=abc",
  };
  const html = bouwHtml(opties);
  assert.match(html, /https:\/\/cmmnty\.luzex\.nl\/artikelen\/ai-en-jij/);
  assert.match(html, /AI &lt;script&gt;/);
  assert.match(html, /Lees meer op CMMNTY/);
  assert.match(html, /afmelden\.html\?token=abc/);
  const tekst = bouwTekst(opties);
  assert.match(tekst, /\[Pro\] AI <script>/);
  assert.match(tekst, /Afmelden voor de nieuwsbrief/);
});
